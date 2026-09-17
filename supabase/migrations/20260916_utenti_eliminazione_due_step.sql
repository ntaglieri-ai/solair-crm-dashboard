-- Eliminazione utente in due passaggi, con riassegnazione obbligatoria.
--
-- Prima di questa migration la cancellazione di un utente con record assegnati
-- falliva contro la foreign key: `utenti` e' referenziata da 49 colonne e otto
-- di quelle FK sono NO ACTION (verificato sul database reale, non deducibile
-- dalle migration: le tabelle legacy sono nate fuori da questa cartella).
--
--   BLOCCANTI (no action)  leads.lead_proprietario_id, clienti.clienti_proprietario_id,
--                          compiti.proprietario_id, scadenze.proprietario_id,
--                          installatori.proprietario_id  -> PROPRIETA', si riassegnano
--                          attivita.utente_id, documenti.caricato_da,
--                          crm_email_accounts.utente_id  -> STORICO/PERSONALE, si sganciano
--   SET NULL               audit_log.utente_id (utente_nome resta), attivita.modificato_da,
--                          note interne, crm_email_log.inviata_da, crm_ai_*, crm_revisioni_pending,
--                          crm_email_template, crm_layout_pagine, custom fields, ...
--   CASCADE                nextcloud_credentials, email_credentials_personali,
--                          cartelle_preferite, crm_layout_ordine_utente,
--                          team_agenti, team_direttori, eventi_calendario (!)
--
-- I passaggi sono due e sono distinti di proposito: il secondo non e' possibile
-- senza il primo.
--
--   1. crm_riassegna_e_disattiva_utente(da, a)
--      Trasferisce TUTTA la proprieta' attiva a un altro utente e disattiva
--      l'account (attivo = false, eliminato_il = now(), riassegnato_a = a).
--      Lo storico non viene toccato: note, audit, documenti e email restano
--      attribuiti a chi li ha davvero fatti. Reversibile.
--
--   2. crm_purga_utente(utente)
--      Cancellazione fisica della riga. Ammessa SOLO su un utente gia' passato
--      dal passaggio 1 e che non possiede piu' nulla: entrambe le condizioni
--      sono ricontrollate qui dentro, sotto lock, non solo in UI.
--
-- Entrambe girano in una sola transazione: una riassegnazione a meta' lascerebbe
-- i record dell'agente divisi fra due proprietari, che e' peggio dell'errore.

begin;

alter table public.utenti
  -- Marca il passaggio 1. NULL = utente normale (anche se disattivato a mano:
  -- "disattivato" e "eliminato" restano due stati diversi).
  add column if not exists eliminato_il timestamptz,
  -- Dove sono finiti i suoi record. Serve alla UI del passaggio 2 e a chiunque
  -- debba ricostruire un trasferimento a distanza di mesi.
  add column if not exists riassegnato_a uuid references public.utenti(id) on delete set null;

comment on column public.utenti.eliminato_il is
  'Istante del passaggio 1 (riassegnazione + disattivazione). Prerequisito della cancellazione fisica.';
comment on column public.utenti.riassegnato_a is
  'Utente che ha ricevuto lead, clienti, compiti, scadenze e installatori nel passaggio 1.';

create index if not exists utenti_eliminato_il_idx
  on public.utenti (eliminato_il)
  where eliminato_il is not null;

-- ---------------------------------------------------------------------------
-- Conteggi per il popup: cosa sta per essere spostato e cosa resta indietro.
-- ---------------------------------------------------------------------------
create or replace function public.crm_utente_conteggi(p_utente uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'proprieta', jsonb_build_object(
      'leads', (select count(*) from public.leads where lead_proprietario_id = p_utente),
      'clienti', (select count(*) from public.clienti where clienti_proprietario_id = p_utente),
      'compiti', (select count(*) from public.compiti where proprietario_id = p_utente),
      'scadenze', (select count(*) from public.scadenze where proprietario_id = p_utente),
      'installatori', (select count(*) from public.installatori where proprietario_id = p_utente),
      'regole_assegnazione', (select count(*) from public.regole_assegnazione where assegna_a = p_utente)
    ),
    'storico', jsonb_build_object(
      'note', (select count(*) from public.attivita where utente_id = p_utente),
      'audit', (select count(*) from public.audit_log where utente_id = p_utente),
      'documenti', (select count(*) from public.documenti where caricato_da = p_utente),
      'email_inviate', (select count(*) from public.crm_email_log where inviata_da = p_utente),
      'eventi_calendario', (select count(*) from public.eventi_calendario where creato_da = p_utente),
      'caselle_personali', (select count(*) from public.crm_email_accounts
                             where utente_id = p_utente and condivisa = false),
      'caselle_condivise', (select count(*) from public.crm_email_accounts
                             where utente_id = p_utente and condivisa),
      'token_mcp', (select count(*) from public.mcp_refresh_tokens
                     where utente_id = p_utente and revoked_at is null)
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Passaggio 1: riassegnazione della proprieta' attiva + disattivazione.
-- ---------------------------------------------------------------------------
create or replace function public.crm_riassegna_e_disattiva_utente(p_da uuid, p_a uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_da public.utenti%rowtype;
  v_a public.utenti%rowtype;
  n_leads integer;
  n_clienti integer;
  n_compiti integer;
  n_scadenze integer;
  n_installatori integer;
  n_regole integer;
begin
  if p_da is null or p_a is null then
    raise exception using errcode = '22023', message = 'Utente e destinatario sono obbligatori';
  end if;
  if p_da = p_a then
    raise exception using errcode = '22023', message = 'Il destinatario non puo'' essere l''utente da eliminare';
  end if;

  -- Lock su entrambe le righe: impedisce che il destinatario venga disattivato
  -- o eliminato mentre gli stiamo intestando 10.000 lead.
  select * into v_da from public.utenti where id = p_da for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Utente da eliminare non trovato';
  end if;

  select * into v_a from public.utenti where id = p_a for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Utente destinatario non trovato';
  end if;
  if coalesce(v_a.attivo, false) is not true or v_a.eliminato_il is not null then
    raise exception using errcode = '22023',
      message = 'Il destinatario deve essere un utente attivo del CRM';
  end if;

  -- Le colonne *_nome / *_zoho_id sono copie denormalizzate del proprietario
  -- (arrivate dall'import Zoho) e sono quelle che diverse viste mostrano a
  -- schermo: senza allinearle la UI continuerebbe a scrivere il nome
  -- dell'agente cancellato accanto a un record che non e' piu' suo.
  --
  -- updated_at NON viene toccato di proposito: un cambio di proprietario non e'
  -- una modifica del record, e bruciare updated_at su migliaia di righe
  -- sporcherebbe ogni ordinamento e filtro "modificati di recente".

  update public.leads
     set lead_proprietario_id = p_a
   where lead_proprietario_id = p_da;
  get diagnostics n_leads = row_count;

  update public.clienti
     set clienti_proprietario_id = p_a,
         clienti_proprietario = v_a.nome,
         clienti_proprietario_zoho_id = v_a.zoho_id
   where clienti_proprietario_id = p_da;
  get diagnostics n_clienti = row_count;

  update public.compiti
     set proprietario_id = p_a,
         proprietario_nome = v_a.nome,
         proprietario_zoho_id = v_a.zoho_id
   where proprietario_id = p_da;
  get diagnostics n_compiti = row_count;

  update public.scadenze
     set proprietario_id = p_a,
         proprietario_nome = v_a.nome
   where proprietario_id = p_da;
  get diagnostics n_scadenze = row_count;

  update public.installatori
     set proprietario_id = p_a
   where proprietario_id = p_da;
  get diagnostics n_installatori = row_count;

  -- Regola di assegnazione automatica puntata sull'agente: e' configurazione
  -- viva, non storico. Lasciandola li' i nuovi lead finirebbero a un utente
  -- disattivato.
  update public.regole_assegnazione
     set assegna_a = p_a
   where assegna_a = p_da;
  get diagnostics n_regole = row_count;

  update public.utenti
     set attivo = false,
         eliminato_il = coalesce(eliminato_il, now()),
         riassegnato_a = p_a,
         updated_at = now()
   where id = p_da;

  return jsonb_build_object(
    'utente', jsonb_build_object('id', v_da.id, 'nome', v_da.nome, 'email', v_da.email),
    'destinatario', jsonb_build_object('id', v_a.id, 'nome', v_a.nome, 'email', v_a.email),
    'spostati', jsonb_build_object(
      'leads', n_leads,
      'clienti', n_clienti,
      'compiti', n_compiti,
      'scadenze', n_scadenze,
      'installatori', n_installatori,
      'regole_assegnazione', n_regole
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Passaggio 2: cancellazione fisica. Solo dopo il passaggio 1.
-- ---------------------------------------------------------------------------
create or replace function public.crm_purga_utente(p_utente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_u public.utenti%rowtype;
  v_residui jsonb;
  n_note integer;
  n_documenti integer;
  n_caselle_personali integer;
  n_caselle_condivise integer;
  n_token integer;
  n_codici integer;
  n_eventi integer;
  n_log integer;
begin
  select * into v_u from public.utenti where id = p_utente for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Utente non trovato';
  end if;

  -- Il vincolo dei due passaggi vive qui, non solo nella UI: chi chiama questa
  -- funzione senza essere passato dalla riassegnazione viene fermato.
  if v_u.eliminato_il is null then
    raise exception using errcode = '42501',
      message = 'Passaggio 1 mancante: riassegna i record e disattiva l''account prima della cancellazione definitiva';
  end if;

  v_residui := (public.crm_utente_conteggi(p_utente) -> 'proprieta');
  if (select sum(value::bigint) from jsonb_each_text(v_residui)) > 0 then
    raise exception using errcode = '23503',
      message = 'L''utente possiede ancora record assegnati: ' || v_residui::text;
  end if;

  -- Storico: il riferimento all'account sparisce, il contenuto no. Le note
  -- restano al loro posto e la UI le mostra come "Sistema"; l'audit_log ha gia'
  -- utente_nome denormalizzato, quindi il nome di chi ha agito resta leggibile.
  update public.attivita set utente_id = null where utente_id = p_utente;
  get diagnostics n_note = row_count;

  update public.documenti set caricato_da = null where caricato_da = p_utente;
  get diagnostics n_documenti = row_count;

  -- Caselle email: quelle personali sono configurazione dell'account e se ne
  -- vanno con lui (la password SMTP cifrata segue in cascade). Quelle CONDIVISE
  -- (info@, commerciale@) restano: perdono solo il proprietario.
  update public.crm_email_accounts set utente_id = null
   where utente_id = p_utente and condivisa;
  get diagnostics n_caselle_condivise = row_count;

  delete from public.crm_email_accounts
   where utente_id = p_utente and condivisa = false;
  get diagnostics n_caselle_personali = row_count;

  -- Token e codici OAuth MCP non hanno foreign key verso utenti: senza questa
  -- pulizia un refresh token valido sopravvivrebbe all'account cancellato.
  delete from public.mcp_refresh_tokens where utente_id = p_utente;
  get diagnostics n_token = row_count;
  delete from public.mcp_oauth_codes where utente_id = p_utente;
  get diagnostics n_codici = row_count;
  update public.mcp_tool_log set utente_id = null where utente_id = p_utente;
  get diagnostics n_log = row_count;

  -- Contato PRIMA della delete: eventi_calendario.creato_da e' not null on
  -- delete cascade, quindi gli eventi creati dall'utente spariscono con lui.
  select count(*) into n_eventi from public.eventi_calendario where creato_da = p_utente;

  delete from public.utenti where id = p_utente;

  return jsonb_build_object(
    'utente', jsonb_build_object('id', v_u.id, 'nome', v_u.nome, 'email', v_u.email,
                                 'auth_user_id', v_u.auth_user_id),
    'sganciati', jsonb_build_object(
      'note', n_note,
      'documenti', n_documenti,
      'caselle_condivise', n_caselle_condivise,
      'log_mcp', n_log
    ),
    'eliminati', jsonb_build_object(
      'caselle_personali', n_caselle_personali,
      'token_mcp', n_token,
      'codici_oauth_mcp', n_codici,
      'eventi_calendario', n_eventi
    )
  );
end;
$$;

-- Backend only: passano tutte dal route handler con service role, che e' l'unico
-- posto dove il permesso crm_settings.account.users.manage viene verificato.
revoke all on function public.crm_utente_conteggi(uuid) from public, anon, authenticated;
revoke all on function public.crm_riassegna_e_disattiva_utente(uuid, uuid) from public, anon, authenticated;
revoke all on function public.crm_purga_utente(uuid) from public, anon, authenticated;
grant execute on function public.crm_utente_conteggi(uuid) to service_role;
grant execute on function public.crm_riassegna_e_disattiva_utente(uuid, uuid) to service_role;
grant execute on function public.crm_purga_utente(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
