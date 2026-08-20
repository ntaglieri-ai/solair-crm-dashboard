-- Hardening RPC esposte da PostgREST.
--
-- PostgreSQL concede EXECUTE su una nuova funzione a PUBLIC per default.
-- Un GRANT successivo al solo ruolo desiderato non rimuove quel privilegio:
-- occorre revocarlo esplicitamente. Questo e' particolarmente critico per le
-- funzioni SECURITY DEFINER, che eseguono con i privilegi del proprietario.

begin;

-- La tabella metadata attesa dalla route e dalle RPC canoniche non esiste nel
-- database live. Viene creata gia' protetta: nessuna policy browser, accesso
-- esclusivo del backend service_role che bypassa RLS.
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

create index if not exists crm_custom_fields_table_column_idx
  on public.crm_custom_fields (table_name, column_name)
  where deleted_at is null;

alter table public.crm_custom_fields enable row level security;

-- RPC che gestiscono segreti: accessibili esclusivamente dal backend tramite
-- la service role. Le REVOKE esplicite coprono anche eventuali grant storici.
revoke all on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.nextcloud_cred_get_password(uuid, text)
  from public, anon, authenticated;
revoke all on function public.email_cred_upsert(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.email_cred_get_password(uuid, text)
  from public, anon, authenticated;

grant execute on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.nextcloud_cred_get_password(uuid, text)
  to service_role;
grant execute on function public.email_cred_upsert(uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.email_cred_get_password(uuid, text)
  to service_role;

-- La pubblicazione usa un client admin solo dopo il controllo applicativo
-- `offerta_commerciale.manage`; non deve essere invocabile dal browser.
revoke all on function public.pubblica_catalogo_offerta_commerciale(uuid)
  from public, anon, authenticated;
grant execute on function public.pubblica_catalogo_offerta_commerciale(uuid)
  to service_role;

-- Riallinea le due RPC di scrittura alla sorgente canonica locale. La versione
-- live precedente tentava di scrivere `attributi_record.key`, colonna non
-- esistente, dopo l'ALTER TABLE. L'errore rendeva inutilizzabile la gestione
-- campi; la transazione PostgREST annullava comunque anche l'ALTER TABLE.
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

  execute format(
    'alter table public.%I add column if not exists %I %s',
    p_table_name,
    p_column_name,
    v_type
  );

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
    raise exception 'Colonna non eliminabile o non registrata come custom: %.%',
      p_table_name,
      p_column_name;
  end if;

  execute format(
    'alter table public.%I drop column if exists %I',
    p_table_name,
    p_column_name
  );

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

-- Gestione dinamica dello schema CRM: la route API verifica prima l'azione
-- `crm_settings.system.schema.manage` e invoca queste RPC con service_role.
-- Nessun client anonimo o autenticato deve poter alterare direttamente lo
-- schema o enumerarne le colonne tramite PostgREST.
revoke all on function public.crm_admin_list_columns(text)
  from public, anon, authenticated;
revoke all on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.crm_admin_drop_column(text, text)
  from public, anon, authenticated;

grant execute on function public.crm_admin_list_columns(text) to service_role;
grant execute on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean)
  to service_role;
grant execute on function public.crm_admin_drop_column(text, text) to service_role;

-- Helper SECURITY DEFINER usati dalle policy RLS. Sono necessari alle sole
-- sessioni autenticate; anon non deve poterli invocare direttamente.
revoke all on function public.nc_path_perms_can_write()
  from public, anon, authenticated;
revoke all on function public.bacheca_can_manage()
  from public, anon, authenticated;
revoke all on function public.email_massa_current_utente()
  from public, anon, authenticated;

grant execute on function public.nc_path_perms_can_write() to authenticated;
grant execute on function public.bacheca_can_manage() to authenticated;
grant execute on function public.email_massa_current_utente() to authenticated;

-- Anche le RPC SECURITY INVOKER non devono ereditare EXECUTE da PUBLIC. RLS
-- resta il livello di autorizzazione sui dati, mentre il grant limita l'API.
revoke all on function public.get_lead_stats()
  from public, anon, authenticated;
revoke all on function public.get_dashboard_aggregates()
  from public, anon, authenticated;
revoke all on function public.get_permission_snapshot()
  from public, anon, authenticated;

grant execute on function public.get_lead_stats() to authenticated;
grant execute on function public.get_dashboard_aggregates() to authenticated;
grant execute on function public.get_permission_snapshot() to authenticated;

commit;
