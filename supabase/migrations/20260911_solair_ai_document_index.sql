-- =====================================================================
-- SolairAI — indice documentale delle fonti Nextcloud autorizzate.
--
-- Le fonti restano le tre righe di crm_ai_settings: lead, cliente,
-- installatore. Ogni fonte attiva viene scansionata ricorsivamente fino ai
-- file piu' profondi; questo indice e' solo una rappresentazione derivata di
-- Nextcloud e puo' essere ricostruito.
-- =====================================================================

begin;

alter table public.crm_ai_settings
  add column if not exists indicizzazione_attiva boolean not null default true,
  add column if not exists ultimo_sync_il timestamptz,
  add column if not exists ultimo_sync_esito text,
  add column if not exists ultimo_sync_errore text,
  add column if not exists ultimo_sync_file integer not null default 0;

create table if not exists public.crm_ai_documenti (
  id uuid primary key default gen_random_uuid(),
  entita text not null,
  source_path text not null,
  path text not null,
  nome text not null,
  estensione text not null default '',
  content_type text,
  file_id text,
  fingerprint text not null,
  dimensione bigint,
  modificato_il timestamptz,
  trovato_il timestamptz not null default now(),
  indicizzato_il timestamptz,
  stato text not null default 'ready',
  testo_estratto text,
  testo_chars integer not null default 0,
  errore text,
  constraint crm_ai_documenti_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  constraint crm_ai_documenti_stato_check
    check (stato in ('ready', 'empty', 'unsupported', 'error', 'deleted')),
  constraint crm_ai_documenti_path_pulito
    check (
      path !~ '^/' and
      path !~ '/$' and
      path !~ '(^|/)\.\.(/|$)'
    )
);

create unique index if not exists crm_ai_documenti_entita_path_idx
  on public.crm_ai_documenti (entita, path);

create index if not exists crm_ai_documenti_source_idx
  on public.crm_ai_documenti (entita, source_path, stato, modificato_il desc);

create index if not exists crm_ai_documenti_fingerprint_idx
  on public.crm_ai_documenti (fingerprint);

create table if not exists public.crm_ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.crm_ai_documenti(id) on delete cascade,
  entita text not null,
  path text not null,
  chunk_index integer not null,
  titolo text not null,
  contenuto text not null,
  keywords text[] not null default '{}',
  aggiornato_il timestamptz not null default now(),
  constraint crm_ai_document_chunks_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  unique (documento_id, chunk_index)
);

create index if not exists crm_ai_document_chunks_entita_idx
  on public.crm_ai_document_chunks (entita);

create index if not exists crm_ai_document_chunks_keywords_idx
  on public.crm_ai_document_chunks using gin (keywords);

create index if not exists crm_ai_document_chunks_path_idx
  on public.crm_ai_document_chunks (path);

comment on table public.crm_ai_documenti is
  'SolairAI: indice derivato dei file nelle fonti Nextcloud autorizzate, separato per lead/cliente/installatore.';

comment on table public.crm_ai_document_chunks is
  'SolairAI: porzioni testuali cercabili estratte dai documenti indicizzati.';

alter table public.crm_ai_documenti enable row level security;
alter table public.crm_ai_document_chunks enable row level security;

drop policy if exists crm_ai_documenti_select on public.crm_ai_documenti;
create policy crm_ai_documenti_select
  on public.crm_ai_documenti for select to authenticated
  using ((select public.solair_ai_can_run()) or (select public.solair_ai_can_review()));

drop policy if exists crm_ai_document_chunks_select on public.crm_ai_document_chunks;
create policy crm_ai_document_chunks_select
  on public.crm_ai_document_chunks for select to authenticated
  using ((select public.solair_ai_can_run()) or (select public.solair_ai_can_review()));

-- Scrittura solo server-side service_role durante la sincronizzazione.
grant select on public.crm_ai_documenti to authenticated;
grant select on public.crm_ai_document_chunks to authenticated;
revoke all on public.crm_ai_documenti from anon;
revoke all on public.crm_ai_document_chunks from anon;

notify pgrst, 'reload schema';

commit;
