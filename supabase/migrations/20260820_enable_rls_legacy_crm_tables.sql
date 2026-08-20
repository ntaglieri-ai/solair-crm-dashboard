-- Phase 2A: protect legacy CRM tables from anonymous PostgREST access while
-- preserving every existing operation performed by signed-in CRM users.
--
-- Deliberately conservative rollout:
--   * authenticated keeps SELECT/INSERT/UPDATE/DELETE through one ALL policy;
--   * service_role continues to bypass RLS (Supabase standard behaviour);
--   * anon receives no policy and therefore no row access;
--   * finer per-role/per-record policies are deferred to a later migration.

begin;

do $migration$
declare
  table_name text;
  protected_tables constant text[] := array[
    'attivita',
    'cliente_comunicazioni',
    'cliente_documenti_stato',
    'cliente_impianto',
    'cliente_iter_burocratico',
    'cliente_logistica',
    'cliente_pagamenti',
    'cliente_tags',
    'collegamenti',
    'compito_tags',
    'crm_column_values',
    'crm_settings',
    'documenti',
    'lead_tags',
    'permessi_azione',
    'permessi_pagina',
    'permessi_record',
    'ruoli'
  ];
begin
  foreach table_name in array protected_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required table public.% does not exist; no RLS change was applied', table_name;
    end if;
  end loop;

  foreach table_name in array protected_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'drop policy if exists crm_authenticated_access on public.%I',
      table_name
    );
    execute format(
      'create policy crm_authenticated_access on public.%I for all to authenticated using (true) with check (true)',
      table_name
    );
  end loop;
end
$migration$;

commit;
