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

create table if not exists public.crm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  field_key text not null,
  label text not null,
  tipo text not null,
  required boolean not null default false,
  visible boolean not null default true,
  system boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  ordinamento integer not null default 0,
  created_by uuid references public.utenti(id) on delete set null,
  updated_by uuid references public.utenti(id) on delete set null,
  table_name text not null,
  column_name text not null,
  db_type text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (modulo, field_key),
  unique (table_name, column_name)
);

create table if not exists public.crm_column_values (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  column_name text not null,
  value text not null,
  label text not null,
  color text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.utenti(id) on delete set null,
  updated_by uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_name, column_name, value)
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

create index if not exists crm_custom_fields_table_column_idx
  on public.crm_custom_fields (table_name, column_name)
  where deleted_at is null;

create index if not exists crm_column_values_table_column_idx
  on public.crm_column_values (table_name, column_name, sort_order)
  where active = true;

create or replace function public.crm_admin_list_columns(
  p_table_name text
)
returns table (
  column_name text,
  data_type text,
  is_nullable text,
  ordinal_position integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table_name not in ('leads', 'clienti', 'compiti', 'scadenze', 'installatori') then
    raise exception 'Tabella CRM non abilitata: %', p_table_name;
  end if;

  return query
  select
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.ordinal_position::integer
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = p_table_name
  order by c.ordinal_position;
end;
$$;

create or replace function public.crm_admin_add_column(
  p_table_name text,
  p_column_name text,
  p_db_type text,
  p_label text,
  p_field_type text,
  p_required boolean default false,
  p_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type text;
begin
  if p_table_name not in ('leads', 'clienti', 'compiti', 'scadenze', 'installatori') then
    raise exception 'Tabella CRM non abilitata: %', p_table_name;
  end if;

  if p_column_name !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Nome colonna non valido: %', p_column_name;
  end if;

  v_type := case p_db_type
    when 'text' then 'text'
    when 'numeric' then 'numeric'
    when 'date' then 'date'
    when 'timestamptz' then 'timestamptz'
    when 'boolean' then 'boolean'
    when 'uuid' then 'uuid'
    when 'text[]' then 'text[]'
    else null
  end;

  if v_type is null then
    raise exception 'Tipo colonna non abilitato: %', p_db_type;
  end if;

  execute format('alter table public.%I add column if not exists %I %s', p_table_name, p_column_name, v_type);

  insert into public.crm_custom_fields (
    modulo,
    field_key,
    label,
    tipo,
    required,
    visible,
    system,
    options,
    ordinamento,
    table_name,
    column_name,
    db_type,
    deleted_at,
    updated_at
  )
  values (
    p_table_name,
    p_column_name,
    p_label,
    p_field_type,
    p_required,
    p_visible,
    false,
    '[]'::jsonb,
    1000,
    p_table_name,
    p_column_name,
    p_db_type,
    null,
    now()
  )
  on conflict (modulo, field_key) do update set
    label = excluded.label,
    tipo = excluded.tipo,
    required = excluded.required,
    visible = excluded.visible,
    system = false,
    table_name = excluded.table_name,
    column_name = excluded.column_name,
    db_type = excluded.db_type,
    deleted_at = null,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.crm_admin_drop_column(
  p_table_name text,
  p_column_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attr public.crm_custom_fields%rowtype;
begin
  if p_table_name not in ('leads', 'clienti', 'compiti', 'scadenze', 'installatori') then
    raise exception 'Tabella CRM non abilitata: %', p_table_name;
  end if;

  if p_column_name !~ '^[a-z][a-z0-9_]*$' then
    raise exception 'Nome colonna non valido: %', p_column_name;
  end if;

  select *
    into v_attr
    from public.crm_custom_fields
   where table_name = p_table_name
     and column_name = p_column_name
     and coalesce(system, false) = false
     and deleted_at is null
   limit 1;

  if v_attr.id is null then
    raise exception 'Colonna non eliminabile o non registrata come custom: %.%', p_table_name, p_column_name;
  end if;

  execute format('alter table public.%I drop column if exists %I', p_table_name, p_column_name);

  update public.crm_custom_fields
     set deleted_at = now(),
         visible = false,
         updated_at = now()
   where id = v_attr.id;

  update public.crm_column_values
     set active = false,
         updated_at = now()
   where table_name = p_table_name
     and column_name = p_column_name;
end;
$$;

grant execute on function public.crm_admin_list_columns(text) to authenticated;
grant execute on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.crm_admin_drop_column(text, text) to authenticated;
