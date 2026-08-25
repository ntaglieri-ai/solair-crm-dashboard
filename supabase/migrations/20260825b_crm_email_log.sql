-- =====================================================================
-- Storico degli invii email riusciti, una riga per DESTINATARIO.
--
-- Perche' una tabella nuova e non audit_log: quel registro ha
-- tipo_evento vincolato da un CHECK a sei valori, nessuno dei quali
-- descrive un invio riuscito, e per gli invii di massa scrive una sola
-- riga aggregata per l'intero batch. Serve invece il contrario — una
-- riga per destinatario — perche' la scheda del lead mostra lo storico
-- di QUEL lead. email_massa_jobs non aiuta: tiene contatori aggregati e
-- lo dichiara esplicitamente ("Nessuna riga destinatario per
-- destinatario").
--
-- Cosa NON e', dichiarato: tracciamento di apertura. Non ci sono
-- colonne aperture/aperta_at e non vanno aggiunte finche' non esiste un
-- meccanismo reale (pixel o webhook SES) che le popoli. La card che
-- questa tabella sostituisce mostrava "Aperture" leggendo un campo
-- cablato a 0: un numero che sembra un dato e non lo e' e' peggio di
-- un'assenza.
-- =====================================================================

begin;

create table if not exists public.crm_email_log (
  id uuid primary key default gen_random_uuid(),

  -- Destinatario come RECORD: esattamente uno dei due e' valorizzato.
  -- Entrambe le colonne perche' /api/leads/send-email e
  -- /api/clienti/send-email condividono lo stesso mailer: una tabella
  -- sola evita di doverne creare una gemella per i clienti.
  -- on delete cascade: lo storico di un lead cancellato non ha piu' una
  -- scheda in cui comparire.
  lead_id uuid references public.leads(id) on delete cascade,
  cliente_id uuid references public.clienti(id) on delete cascade,

  -- Indirizzo a cui e' partita davvero, congelato: se poi il contatto
  -- cambia email, lo storico deve continuare a dire dove ando'.
  destinatario text not null,

  -- Mittente REALE usato (crm_email_accounts.email, o quello di sistema
  -- quando l'utente non ha una casella propria). Testo e non FK: la
  -- riga deve sopravvivere alla cancellazione della casella, ed e'
  -- l'indirizzo che conta, non l'identita' del record.
  from_email text not null,
  from_nome text,

  oggetto text not null,

  -- Chi ha premuto invia. on delete set null: lo storico dell'invio
  -- resta anche se l'utente viene rimosso dal CRM, stesso criterio gia'
  -- adottato da email_massa_jobs.creato_da.
  inviata_da uuid references public.utenti(id) on delete set null,

  data_invio timestamptz not null default now(),

  constraint crm_email_log_un_solo_destinatario check (
    (lead_id is not null)::int + (cliente_id is not null)::int = 1
  )
);

comment on table public.crm_email_log is
  'Storico invii email riusciti, una riga per destinatario. Nessun tracciamento di apertura.';

-- La scheda legge per record ordinando dal piu' recente: l'indice
-- rispecchia quella query e non la sola colonna di join.
create index if not exists crm_email_log_lead_idx
  on public.crm_email_log (lead_id, data_invio desc)
  where lead_id is not null;

create index if not exists crm_email_log_cliente_idx
  on public.crm_email_log (cliente_id, data_invio desc)
  where cliente_id is not null;

-- ---------------------------------------------------------------------
-- RLS
--
-- Lettura: chi vede il record vede il suo storico. La subquery sul
-- genitore e' a sua volta soggetta alle policy di leads/clienti, quindi
-- lo scoping per sede/proprieta' viene ereditato senza riscriverne il
-- predicato — stessa forma gia' usata dalle estensioni di clienti in
-- 20260824d.
--
-- Scrittura: nessuna policy, di proposito. Le righe le scrive il
-- service_role dalle route di invio, come per audit_log: un registro
-- che dipende dai permessi di chi lo genera non e' un registro. Senza
-- policy di INSERT nessun client autenticato puo' fabbricare uno
-- storico di invii mai avvenuti.
-- ---------------------------------------------------------------------
alter table public.crm_email_log enable row level security;

drop policy if exists crm_email_log_select on public.crm_email_log;
create policy crm_email_log_select
  on public.crm_email_log for select to authenticated
  using (
    (lead_id is not null and exists (
      select 1 from public.leads l where l.id = crm_email_log.lead_id
    ))
    or
    (cliente_id is not null and exists (
      select 1 from public.clienti c where c.id = crm_email_log.cliente_id
    ))
  );

revoke truncate on public.crm_email_log from anon, authenticated;

commit;
