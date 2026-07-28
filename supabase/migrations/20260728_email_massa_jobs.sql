-- Coda/stato degli invii email di MASSA (Lead / Clienti / Installatori).
--
-- Perche' una tabella e non una risposta sincrona: l'invio usa la casella
-- Aruba personale dell'agente con pacing 400ms (vedi lib/email/lead-mailer.ts),
-- quindi 100 destinatari = ~40s+ di lavoro. Troppo per tenere aperta una
-- richiesta HTTP: l'endpoint accoda e risponde subito, l'invio vero prosegue
-- in background via after() e aggiorna questa riga mentre procede. Il
-- frontend polla /api/email-massa/[jobId]/status per la barra di avanzamento.
--
-- Nessuna riga destinatario per destinatario: servono solo i contatori
-- aggregati per la UI. Gli errori dei singoli invii finiscono nei log server.

begin;

create table if not exists public.email_massa_jobs (
  id uuid primary key default gen_random_uuid(),
  record_tipo text not null,
  oggetto text not null,
  totale integer not null default 0,
  inviate integer not null default 0,
  fallite integer not null default 0,
  stato text not null default 'in_corso',
  -- Valorizzato solo quando stato = 'errore' (es. SMTP irraggiungibile): i
  -- fallimenti dei singoli destinatari sono contati in `fallite`, non qui.
  errore text,
  -- on delete set null: lo storico dell'invio resta anche se l'agente viene
  -- rimosso dal CRM.
  creato_da uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completato_at timestamptz,
  constraint email_massa_jobs_record_tipo_check
    check (record_tipo in ('lead', 'cliente', 'installatore')),
  constraint email_massa_jobs_stato_check
    check (stato in ('in_corso', 'completato', 'errore'))
);

comment on table public.email_massa_jobs is
  'Stato/avanzamento degli invii email di massa accodati da /api/email-massa.';

-- L''unica lettura non-per-id e' "i miei job recenti".
create index if not exists email_massa_jobs_creato_da_idx
  on public.email_massa_jobs (creato_da, created_at desc);

alter table public.email_massa_jobs enable row level security;

-- Stesso pattern di bacheca_can_manage(): SECURITY DEFINER per evitare la
-- ricorsione con la RLS di `utenti`.
create or replace function public.email_massa_current_utente()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.utenti u
  where u.auth_user_id = (select auth.uid())
     or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  limit 1;
$$;

grant execute on function public.email_massa_current_utente() to authenticated;

-- Solo SELECT, e solo sui propri job: un invio di massa e' un'azione
-- personale dell'agente. INSERT/UPDATE non hanno policy => passano solo dal
-- service_role (le API route server-side), mai da un client del browser.
drop policy if exists email_massa_jobs_read on public.email_massa_jobs;
create policy email_massa_jobs_read
  on public.email_massa_jobs
  for select
  to authenticated
  using (creato_da = (select public.email_massa_current_utente()));

commit;

-- Verifica rapida dopo l'esecuzione:
-- select id, record_tipo, stato, inviate, fallite, totale from email_massa_jobs
--   order by created_at desc limit 10;
