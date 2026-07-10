-- Nextcloud provisioning: credenziali cifrate + cartelle preferite.
-- Idempotente: rieseguibile senza effetti collaterali.
--
-- Modello: NON usiamo piu' l'OAuth interattivo per-utente. Ogni utente CRM ha
-- un account Nextcloud creato via Provisioning API; per quell'account viene
-- generata una app-password server-side (OCS core/getapppassword) che qui
-- viene salvata CIFRATA con pgcrypto (pgp_sym_encrypt). La chiave simmetrica
-- non e' mai in tabella: viene passata alle RPC dal server (env
-- NEXTCLOUD_CRED_ENC_KEY). La app-password non e' MAI salvata in chiaro.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Credenziali Nextcloud per-utente (una riga per utente CRM).
-- ---------------------------------------------------------------------------
create table if not exists public.nextcloud_credentials (
  utente_id uuid primary key references public.utenti(id) on delete cascade,
  nc_username text not null,
  app_password_enc bytea,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nextcloud_credentials_status_check
    check (status in ('active', 'pending', 'failed', 'disabled'))
);

comment on table public.nextcloud_credentials is
  'App-password Nextcloud cifrata (pgcrypto) e stato di provisioning per utente CRM.';
comment on column public.nextcloud_credentials.app_password_enc is
  'App-password cifrata con pgp_sym_encrypt(NEXTCLOUD_CRED_ENC_KEY). Mai in chiaro.';
comment on column public.nextcloud_credentials.status is
  'active = provisioning ok; pending = da eseguire; failed = errore (vedi last_error); disabled = account NC disabilitato.';

-- Solo il service_role puo' leggere/scrivere: nessuna policy => RLS blocca
-- qualunque client autenticato. I segreti non arrivano mai al browser.
alter table public.nextcloud_credentials enable row level security;

-- ---------------------------------------------------------------------------
-- RPC di cifratura/decifratura. security definer: la chiave arriva come
-- argomento dal server, mai persistita. Esecuzione riservata a service_role.
-- ---------------------------------------------------------------------------
create or replace function public.nextcloud_cred_upsert(
  p_utente_id uuid,
  p_username text,
  p_app_password text,
  p_key text,
  p_status text default 'active',
  p_last_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.nextcloud_credentials as nc
    (utente_id, nc_username, app_password_enc, status, last_error, updated_at)
  values (
    p_utente_id,
    p_username,
    case
      when p_app_password is null or p_app_password = '' then null
      else pgp_sym_encrypt(p_app_password, p_key)
    end,
    p_status,
    p_last_error,
    now()
  )
  on conflict (utente_id) do update set
    nc_username = excluded.nc_username,
    -- non azzerare una password valida se questo upsert non ne porta una nuova
    app_password_enc = coalesce(excluded.app_password_enc, nc.app_password_enc),
    status = excluded.status,
    last_error = excluded.last_error,
    updated_at = now();
end;
$$;

create or replace function public.nextcloud_cred_get_password(
  p_utente_id uuid,
  p_key text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pw text;
begin
  select pgp_sym_decrypt(app_password_enc, p_key)
    into v_pw
  from public.nextcloud_credentials
  where utente_id = p_utente_id
    and app_password_enc is not null;
  return v_pw;
end;
$$;

revoke all on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text) from public;
revoke all on function public.nextcloud_cred_get_password(uuid, text) from public;
grant execute on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text) to service_role;
grant execute on function public.nextcloud_cred_get_password(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Cartelle preferite per-utente (schema minimo).
-- ---------------------------------------------------------------------------
create table if not exists public.cartelle_preferite (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references public.utenti(id) on delete cascade,
  path text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (utente_id, path)
);

create index if not exists cartelle_preferite_utente_idx
  on public.cartelle_preferite (utente_id);

comment on table public.cartelle_preferite is
  'Cartelle Nextcloud preferite per utente CRM. path relativo alla root files utente.';

alter table public.cartelle_preferite enable row level security;

-- Ogni utente gestisce solo i propri preferiti. Il match segue la stessa
-- logica di get_permission_snapshot: auth_user_id = auth.uid() OPPURE email
-- combaciante col JWT (per utenti importati senza auth_user_id collegato).
drop policy if exists cartelle_preferite_self on public.cartelle_preferite;
create policy cartelle_preferite_self on public.cartelle_preferite
  for all
  using (
    utente_id in (
      select id from public.utenti
      where auth_user_id = auth.uid()
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  with check (
    utente_id in (
      select id from public.utenti
      where auth_user_id = auth.uid()
         or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
