-- =====================================================================
-- SolairAI — lettura assistita dei documenti Nextcloud.
--
-- Tre tabelle, una per ogni pezzo del giro:
--   crm_ai_settings        il path Nextcloud da cui leggere, per tipo entita'
--   crm_ai_file_log        i file gia' letti, per il check "novita'"
--   crm_revisioni_pending  i campi proposti su valori gia' pieni
--
-- Impostazione RLS: come per le note interne, il vero controllo sta qui e
-- non nella UI. Le tre chiavi di permesso sono azioni CRM, cosi' la pagina
-- "Permessi SolairAI" le concede senza toccare il database:
--   solair_ai.run              avvia aggiornamenti e creazioni
--   solair_ai.revisioni.view   vede la coda di revisione
-- La configurazione dei path resta con gli altri settaggi di sistema
-- (crm_settings.system.schema.manage), non con l'uso del bot: chi puo'
-- usare SolairAI non deve per questo poter cambiare da dove legge.
--
-- crm_current_user_can_action(azione, ruoli_default) esiste gia' ed e'
-- la stessa funzione usata da note_interne_can_access(): si riusa invece
-- di scrivere un secondo gate che potrebbe divergere.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Gate riutilizzabili
-- ---------------------------------------------------------------------
-- Uso del bot. Default ai ruoli che gia' governano i dati: un AGENT non
-- scrive sul CRM per conto di un documento finche' non glielo si concede
-- esplicitamente dalla pagina permessi.
create or replace function public.solair_ai_can_run()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.crm_current_user_can_action(
    'solair_ai.run',
    array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
  );
$$;

-- Lettura della coda di revisione. Separata da .run: si puo' dare a chi
-- controlla i dati senza dargli il permesso di avviare scritture.
create or replace function public.solair_ai_can_review()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.crm_current_user_can_action(
    'solair_ai.revisioni.view',
    array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
  );
$$;

-- Configurazione dei path: e' amministrazione di sistema, non uso.
create or replace function public.solair_ai_can_configure()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.crm_current_user_can_action(
    'crm_settings.system.schema.manage',
    array['SUPERADMIN', 'ADMIN']
  );
$$;

-- ---------------------------------------------------------------------
-- 1. crm_ai_settings — un path Nextcloud per tipo entita'
-- ---------------------------------------------------------------------
create table if not exists public.crm_ai_settings (
  id uuid primary key default gen_random_uuid(),
  entita text not null unique,
  -- Path relativo alla root files dell'utente Nextcloud commerciale
  -- (quello di commercialNextcloudUser), senza slash iniziale.
  -- Vuoto = non configurato: SolairAI lo dice invece di cercare nella root.
  nextcloud_path text not null default '',
  attivo boolean not null default true,
  aggiornato_da uuid references public.utenti(id) on delete set null,
  aggiornato_il timestamptz not null default now(),
  constraint crm_ai_settings_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  -- Niente slash iniziale/finale ne' risalite: il path finisce dentro una
  -- URL WebDAV, e "../" la porterebbe fuori dalla cartella configurata.
  constraint crm_ai_settings_path_pulito
    check (
      nextcloud_path !~ '^/' and
      nextcloud_path !~ '/$' and
      nextcloud_path !~ '(^|/)\.\.(/|$)'
    )
);

comment on table public.crm_ai_settings is
  'SolairAI: cartella Nextcloud di lettura per tipo entita''. Path relativo alla root files dell''utente commerciale.';

-- Le tre righe esistono sempre: la pagina di configurazione le modifica,
-- non le crea, cosi' non c'e' uno stato "riga mancante" da gestire.
insert into public.crm_ai_settings (entita, nextcloud_path)
values ('lead', ''), ('cliente', ''), ('installatore', '')
on conflict (entita) do nothing;

alter table public.crm_ai_settings enable row level security;

-- La lettura serve a chiunque usi il bot, non solo a chi configura.
drop policy if exists crm_ai_settings_select on public.crm_ai_settings;
create policy crm_ai_settings_select
  on public.crm_ai_settings for select to authenticated
  using (true);

drop policy if exists crm_ai_settings_update on public.crm_ai_settings;
create policy crm_ai_settings_update
  on public.crm_ai_settings for update to authenticated
  using ((select public.solair_ai_can_configure()))
  with check ((select public.solair_ai_can_configure()));

-- Nessuna policy INSERT/DELETE: le tre righe sono fisse.

grant select, update on public.crm_ai_settings to authenticated;
revoke all on public.crm_ai_settings from anon;

-- ---------------------------------------------------------------------
-- 2. crm_ai_file_log — i file gia' letti
-- ---------------------------------------------------------------------
create table if not exists public.crm_ai_file_log (
  id uuid primary key default gen_random_uuid(),
  entita text not null,
  -- Nullo finche' il record non esiste: un file puo' essere letto per un
  -- lead che l'utente decide poi di non creare. La riga resta comunque,
  -- altrimenti il file tornerebbe "nuovo" al giro dopo.
  record_id uuid,
  path text not null,
  -- etag Nextcloud quando c'e', altrimenti dimensione+data modifica:
  -- stessa regola gia' usata dal sync del listino. E' l'impronta del
  -- CONTENUTO, quindi un file modificato torna nuovo — che e' quello che
  -- serve al check "novita'".
  fingerprint text not null,
  dimensione bigint,
  modificato_il timestamptz,
  letto_il timestamptz not null default now(),
  letto_da uuid references public.utenti(id) on delete set null,
  esito text not null default 'letto',
  errore text,
  constraint crm_ai_file_log_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  constraint crm_ai_file_log_esito_check
    check (esito in ('letto', 'errore'))
);

-- La chiave del check "novita'": stesso file, stessa versione, stesso
-- record => gia' letto. `nulls not distinct` perche' record_id nullo deve
-- collidere con se stesso, altrimenti i file letti senza record creato si
-- duplicherebbero a ogni conversazione.
create unique index if not exists crm_ai_file_log_unico_idx
  on public.crm_ai_file_log (entita, record_id, path, fingerprint)
  nulls not distinct;

-- La lettura vera dell'app: "cosa ho gia' letto per questo record".
create index if not exists crm_ai_file_log_record_idx
  on public.crm_ai_file_log (entita, record_id, letto_il desc);

comment on table public.crm_ai_file_log is
  'SolairAI: file Nextcloud gia'' processati. Il confronto path+fingerprint decide se c''e'' qualcosa di nuovo da leggere.';

alter table public.crm_ai_file_log enable row level security;

-- Chi puo' usare il bot vede e scrive il proprio registro di lettura; chi
-- revisiona lo vede per risalire alla fonte di una proposta.
drop policy if exists crm_ai_file_log_select on public.crm_ai_file_log;
create policy crm_ai_file_log_select
  on public.crm_ai_file_log for select to authenticated
  using ((select public.solair_ai_can_run()) or (select public.solair_ai_can_review()));

-- L'autore non e' negoziabile, come per le note interne: impedisce di
-- firmare una lettura a nome di un altro passando da PostgREST diretto.
drop policy if exists crm_ai_file_log_insert on public.crm_ai_file_log;
create policy crm_ai_file_log_insert
  on public.crm_ai_file_log for insert to authenticated
  with check (
    (select public.solair_ai_can_run())
    and letto_da = (select public.current_utente_id())
  );

-- L'aggiornamento serve solo ad attaccare il record_id a una riga scritta
-- prima che il record esistesse.
drop policy if exists crm_ai_file_log_update on public.crm_ai_file_log;
create policy crm_ai_file_log_update
  on public.crm_ai_file_log for update to authenticated
  using ((select public.solair_ai_can_run()))
  with check ((select public.solair_ai_can_run()));

grant select, insert, update on public.crm_ai_file_log to authenticated;
revoke all on public.crm_ai_file_log from anon;

-- ---------------------------------------------------------------------
-- 3. crm_revisioni_pending — i campi gia' pieni, mai sovrascritti
-- ---------------------------------------------------------------------
create table if not exists public.crm_revisioni_pending (
  id uuid primary key default gen_random_uuid(),
  record_tipo text not null,
  record_id uuid not null,
  -- Colonna reale della tabella del record, piu' l'etichetta CRM per
  -- mostrarla senza dover rifare la mappatura lato pagina.
  campo text not null,
  campo_etichetta text,
  valore_attuale text,
  valore_proposto text not null,
  -- Path Nextcloud del documento da cui viene la proposta.
  fonte_documento text not null,
  stato text not null default 'pending',
  creato_da uuid references public.utenti(id) on delete set null,
  creato_il timestamptz not null default now(),
  deciso_da uuid references public.utenti(id) on delete set null,
  deciso_il timestamptz,
  constraint crm_revisioni_pending_tipo_check
    check (record_tipo in ('lead', 'cliente', 'installatore')),
  constraint crm_revisioni_pending_stato_check
    check (stato in ('pending', 'accettata', 'rifiutata')),
  constraint crm_revisioni_pending_proposto_non_vuoto
    check (length(btrim(valore_proposto)) > 0),
  -- I due campi della decisione si muovono insieme: una riga decisa senza
  -- data (o viceversa) perderebbe meta' dell'informazione.
  constraint crm_revisioni_pending_decisione_coerente
    check (
      (stato = 'pending' and deciso_da is null and deciso_il is null)
      or (stato <> 'pending' and deciso_il is not null)
    )
);

-- La coda vera: le pendenti, dalla piu' recente. Indice parziale, cosi'
-- le decise non la gonfiano.
create index if not exists crm_revisioni_pending_coda_idx
  on public.crm_revisioni_pending (creato_il desc)
  where stato = 'pending';

create index if not exists crm_revisioni_pending_record_idx
  on public.crm_revisioni_pending (record_tipo, record_id, creato_il desc);

-- Una proposta pendente per campo e per record: una seconda lettura dello
-- stesso documento aggiorna la riga invece di accodarne una gemella.
create unique index if not exists crm_revisioni_pending_una_per_campo_idx
  on public.crm_revisioni_pending (record_tipo, record_id, campo)
  where stato = 'pending';

comment on table public.crm_revisioni_pending is
  'SolairAI: campi gia'' valorizzati per cui un documento propone un valore diverso. Non vengono mai scritti sul record senza una decisione.';

alter table public.crm_revisioni_pending enable row level security;

drop policy if exists crm_revisioni_pending_select on public.crm_revisioni_pending;
create policy crm_revisioni_pending_select
  on public.crm_revisioni_pending for select to authenticated
  using ((select public.solair_ai_can_review()));

drop policy if exists crm_revisioni_pending_insert on public.crm_revisioni_pending;
create policy crm_revisioni_pending_insert
  on public.crm_revisioni_pending for insert to authenticated
  with check (
    (select public.solair_ai_can_run())
    and creato_da = (select public.current_utente_id())
    and stato = 'pending'
  );

-- Decidere una revisione e' un'azione di controllo: la fa chi vede la coda.
drop policy if exists crm_revisioni_pending_update on public.crm_revisioni_pending;
create policy crm_revisioni_pending_update
  on public.crm_revisioni_pending for update to authenticated
  using ((select public.solair_ai_can_review()))
  with check ((select public.solair_ai_can_review()));

drop policy if exists crm_revisioni_pending_delete on public.crm_revisioni_pending;
create policy crm_revisioni_pending_delete
  on public.crm_revisioni_pending for delete to authenticated
  using ((select public.solair_ai_can_review()));

grant select, insert, update, delete on public.crm_revisioni_pending to authenticated;
revoke all on public.crm_revisioni_pending from anon;

notify pgrst, 'reload schema';

commit;
