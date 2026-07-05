-- Identita Zoho e mapping utenti per migrazioni ripetibili.
-- Questa migrazione non crea utenti Auth e non invia inviti.

alter table public.utenti
  add column if not exists zoho_id text;

create unique index if not exists utenti_zoho_id_unique
  on public.utenti (zoho_id)
  where zoho_id is not null;

create table if not exists public.zoho_user_staging (
  zoho_id text primary key,
  full_name text not null,
  email text not null,
  status text not null,
  role_id text,
  role_name text,
  profile_id text,
  profile_name text,
  reporting_to_id text,
  reporting_to_name text,
  suggested_role_code text,
  crm_user_id uuid references public.utenti(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoho_user_staging_status_check
    check (status in ('active', 'inactive', 'deleted'))
);

create index if not exists zoho_user_staging_status_idx
  on public.zoho_user_staging (status);

create index if not exists zoho_user_staging_email_idx
  on public.zoho_user_staging (lower(email));

comment on table public.zoho_user_staging is
  'Registro completo degli utenti Zoho, inclusi utenti eliminati non promossi nel CRM.';

comment on column public.utenti.zoho_id is
  'Identificatore utente Zoho senza il prefisso zcrm_.';

alter table public.zoho_user_staging enable row level security;
