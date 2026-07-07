-- Allineamento Compiti a export Zoho CRM.
-- Idempotente: si puo' rieseguire prima di un nuovo import/delta.

create extension if not exists pgcrypto;

create table if not exists public.compiti (
  id uuid primary key default gen_random_uuid(),
  oggetto text,
  stato text,
  priorita text,
  scadenza timestamp with time zone,
  descrizione text,
  sede text,
  correlato_id uuid,
  correlato_tipo text,
  proprietario_id uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.compiti
  add column if not exists zoho_record_id text,
  add column if not exists proprietario_zoho_id text,
  add column if not exists proprietario_nome text,
  add column if not exists nome_contatto_zoho_id text,
  add column if not exists nome_contatto text,
  add column if not exists correlato_zoho_id text,
  add column if not exists correlato_nome text,
  add column if not exists ripeti text,
  add column if not exists promemoria timestamp with time zone,
  add column if not exists creato_da_zoho_id text,
  add column if not exists creato_da_nome text,
  add column if not exists modificato_da_zoho_id text,
  add column if not exists modificato_da_nome text,
  add column if not exists ora_creazione timestamp with time zone,
  add column if not exists ora_modifica timestamp with time zone,
  add column if not exists orario_chiusura timestamp with time zone,
  add column if not exists tag text,
  add column if not exists locked boolean default false,
  add column if not exists ora_ultima_attivita timestamp with time zone;

create unique index if not exists compiti_zoho_record_id_uidx
  on public.compiti (zoho_record_id)
  where zoho_record_id is not null;

create index if not exists compiti_stato_idx
  on public.compiti (stato);

create index if not exists compiti_priorita_idx
  on public.compiti (priorita);

create index if not exists compiti_scadenza_idx
  on public.compiti (scadenza);

create index if not exists compiti_proprietario_nome_idx
  on public.compiti (proprietario_nome);

create index if not exists compiti_nome_contatto_idx
  on public.compiti (nome_contatto);

create index if not exists compiti_correlato_zoho_idx
  on public.compiti (correlato_zoho_id);

create index if not exists compiti_ora_ultima_attivita_idx
  on public.compiti (ora_ultima_attivita);
