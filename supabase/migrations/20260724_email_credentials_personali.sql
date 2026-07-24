-- Credenziali email personali per-utente (invio email a lead a nome proprio).
-- Stesso schema/pattern di nextcloud_credentials (20260710): cifratura
-- pgcrypto, solo service_role puo' leggere/scrivere, la password non e' MAI
-- salvata in chiaro e non tocca mai un client autenticato dal browser.
--
-- Riusa la stessa chiave simmetrica NEXTCLOUD_CRED_ENC_KEY (via
-- nextcloudCredKey() in lib/nextcloud/config.ts) — e' solo una chiave di
-- cifratura generica, nessun nuovo secret da configurare su Vercel.

create table if not exists public.email_credentials_personali (
  utente_id uuid primary key references public.utenti(id) on delete cascade,
  smtp_user text not null,
  smtp_password_enc bytea,
  status text not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_credentials_personali_status_check
    check (status in ('active', 'pending', 'failed'))
);

comment on table public.email_credentials_personali is
  'Casella email Aruba personale per-utente (mittente reale nelle email verso i lead), password cifrata pgcrypto.';
comment on column public.email_credentials_personali.smtp_password_enc is
  'Password cifrata con pgp_sym_encrypt(NEXTCLOUD_CRED_ENC_KEY). Mai in chiaro.';

alter table public.email_credentials_personali enable row level security;
-- Nessuna policy => RLS blocca qualunque client autenticato: solo il
-- service_role (via API route server-side) puo' leggere/scrivere.

create or replace function public.email_cred_upsert(
  p_utente_id uuid,
  p_smtp_user text,
  p_smtp_password text,
  p_key text,
  p_status text default 'active',
  p_last_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_credentials_personali as ec
    (utente_id, smtp_user, smtp_password_enc, status, last_error, updated_at)
  values (
    p_utente_id,
    p_smtp_user,
    case
      when p_smtp_password is null or p_smtp_password = '' then null
      else pgp_sym_encrypt(p_smtp_password, p_key)
    end,
    p_status,
    p_last_error,
    now()
  )
  on conflict (utente_id) do update set
    smtp_user = excluded.smtp_user,
    smtp_password_enc = coalesce(excluded.smtp_password_enc, ec.smtp_password_enc),
    status = excluded.status,
    last_error = excluded.last_error,
    updated_at = now();
end;
$$;

create or replace function public.email_cred_get_password(
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
  select pgp_sym_decrypt(smtp_password_enc, p_key)
    into v_pw
  from public.email_credentials_personali
  where utente_id = p_utente_id
    and smtp_password_enc is not null;
  return v_pw;
end;
$$;

revoke all on function public.email_cred_upsert(uuid, text, text, text, text, text) from public;
revoke all on function public.email_cred_get_password(uuid, text) from public;
grant execute on function public.email_cred_upsert(uuid, text, text, text, text, text) to service_role;
grant execute on function public.email_cred_get_password(uuid, text) to service_role;
