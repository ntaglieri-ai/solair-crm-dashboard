-- =====================================================================
-- SolairAI — job e progresso dell'indicizzazione documentale.
--
-- Su spazi Nextcloud grandi il pulsante non puo' tenere aperta una request
-- HTTP fino alla fine. Questa tabella e' il contatore visibile dalla UI:
-- check e sync partono in background, aggiornano qui i progressi, e il
-- frontend fa polling dello stato.
-- =====================================================================

begin;

create table if not exists public.crm_ai_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  entita text not null,
  modo text not null,
  source_path text not null default '',
  stato text not null default 'queued',
  fase text not null default 'queued',
  scanned integer not null default 0,
  totale integer not null default 0,
  processati integer not null default 0,
  da_aggiornare integer not null default 0,
  invariati integer not null default 0,
  cancellati integer not null default 0,
  aggiornati integer not null default 0,
  chunks integer not null default 0,
  errori integer not null default 0,
  warnings integer not null default 0,
  totale_bytes bigint not null default 0,
  ultimo_path text,
  errore text,
  risultato jsonb,
  creato_da uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completato_at timestamptz,
  constraint crm_ai_sync_jobs_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  constraint crm_ai_sync_jobs_modo_check
    check (modo in ('check', 'sync')),
  constraint crm_ai_sync_jobs_stato_check
    check (stato in ('queued', 'scanning', 'running', 'completed', 'error'))
);

create index if not exists crm_ai_sync_jobs_entita_idx
  on public.crm_ai_sync_jobs (entita, created_at desc);

create index if not exists crm_ai_sync_jobs_creato_da_idx
  on public.crm_ai_sync_jobs (creato_da, created_at desc);

create table if not exists public.crm_ai_sync_job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.crm_ai_sync_jobs(id) on delete cascade,
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
  priority integer not null default 50,
  stato text not null default 'queued',
  chunk_count integer not null default 0,
  errore text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint crm_ai_sync_job_files_entita_check
    check (entita in ('lead', 'cliente', 'installatore')),
  constraint crm_ai_sync_job_files_stato_check
    check (stato in ('queued', 'running', 'done', 'error', 'skipped')),
  unique (job_id, path)
);

create index if not exists crm_ai_sync_job_files_job_stato_idx
  on public.crm_ai_sync_job_files (job_id, stato, priority, path);

create index if not exists crm_ai_sync_job_files_path_idx
  on public.crm_ai_sync_job_files (entita, path);

alter table public.crm_ai_sync_jobs enable row level security;
alter table public.crm_ai_sync_job_files enable row level security;

drop policy if exists crm_ai_sync_jobs_select on public.crm_ai_sync_jobs;
create policy crm_ai_sync_jobs_select
  on public.crm_ai_sync_jobs for select to authenticated
  using ((select public.solair_ai_can_configure()));

drop policy if exists crm_ai_sync_job_files_select on public.crm_ai_sync_job_files;
create policy crm_ai_sync_job_files_select
  on public.crm_ai_sync_job_files for select to authenticated
  using ((select public.solair_ai_can_configure()));

grant select on public.crm_ai_sync_jobs to authenticated;
grant select on public.crm_ai_sync_job_files to authenticated;
revoke all on public.crm_ai_sync_jobs from anon;
revoke all on public.crm_ai_sync_job_files from anon;

comment on table public.crm_ai_sync_jobs is
  'SolairAI: stato dei job di check/sync dell''indice documentale Nextcloud.';

comment on table public.crm_ai_sync_job_files is
  'SolairAI: coda file per-file dei job di indicizzazione, usata per progresso e ripresa.';

notify pgrst, 'reload schema';

commit;
