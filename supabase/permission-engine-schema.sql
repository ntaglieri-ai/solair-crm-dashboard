-- Permission Engine v1
-- Estende i permessi esistenti con azioni granulari, campi e scope dati.
-- File Manager lasciato fuori intenzionalmente: verra' modellato quando la
-- struttura cartelle sara' definitiva.

create table if not exists public.permessi_azione (
  id uuid primary key default gen_random_uuid(),
  ruolo_id uuid not null references public.ruoli(id) on delete cascade,
  azione text not null,
  abilitato boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ruolo_id, azione)
);

create table if not exists public.permessi_campo (
  id uuid primary key default gen_random_uuid(),
  ruolo_id uuid not null references public.ruoli(id) on delete cascade,
  modulo text not null,
  campo text not null,
  accesso text not null default 'hidden',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permessi_campo_accesso_check
    check (accesso in ('hidden', 'readonly', 'editable')),
  unique (ruolo_id, modulo, campo)
);

create table if not exists public.permessi_scope (
  id uuid primary key default gen_random_uuid(),
  ruolo_id uuid not null references public.ruoli(id) on delete cascade,
  risorsa text not null,
  scope text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permessi_scope_scope_check
    check (scope in ('none', 'own', 'own_sede', 'assigned', 'team', 'all')),
  unique (ruolo_id, risorsa)
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.utenti(id) on delete cascade,
  chiave text not null,
  valore jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, chiave)
);

create table if not exists public.attributi_record (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  key text not null,
  label text not null,
  tipo text not null,
  required boolean not null default false,
  visible boolean not null default true,
  system boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  ordinamento integer not null default 0,
  created_by uuid references public.utenti(id) on delete set null,
  updated_by uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (modulo, key)
);

create table if not exists public.crm_settings_store (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists permessi_azione_ruolo_idx
  on public.permessi_azione (ruolo_id);

create index if not exists permessi_campo_ruolo_modulo_idx
  on public.permessi_campo (ruolo_id, modulo);

create index if not exists permessi_scope_ruolo_idx
  on public.permessi_scope (ruolo_id);

create index if not exists user_preferences_user_idx
  on public.user_preferences (user_id);

create index if not exists crm_settings_store_updated_idx
  on public.crm_settings_store (updated_at desc);
