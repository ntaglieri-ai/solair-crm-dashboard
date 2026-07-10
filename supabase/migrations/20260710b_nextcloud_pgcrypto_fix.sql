-- Fix: pgp_sym_encrypt/pgp_sym_decrypt non risolti dentro le RPC Nextcloud.
--
-- Causa: su Supabase l'estensione pgcrypto e' installata nello schema
-- "extensions", non in "public". Le due funzioni erano definite con
-- `set search_path = public`, quindi il resolver non trovava pgp_sym_* ed
-- errava con "function pgp_sym_encrypt(text, text) does not exist".
--
-- Correzione: `set search_path = public, extensions`. NON fully-qualified
-- (extensions.pgp_sym_encrypt): mantenere lo schema fuori dalle call e nel
-- search_path e' piu' robusto rispetto a futuri cambi di Supabase — il
-- resolver trova pgcrypto sia che stia in "extensions" sia che stia in
-- "public", senza hardcodare un nome di schema che un domani potrebbe cambiare.
-- "public" resta primo cosi' i riferimenti a public.nextcloud_credentials
-- continuano a risolversi come prima.
--
-- Idempotente: solo CREATE OR REPLACE dei due corpi funzione. Nessuna modifica
-- a tabella, RLS, revoke/grant (le firme sono identiche, i grant esistenti
-- restano validi).

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
set search_path = public, extensions
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
set search_path = public, extensions
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
