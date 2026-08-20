-- Rollback for 20260820_enable_rls_legacy_crm_tables.sql.
-- Restores the audited pre-migration state: RLS disabled on all 18 tables.

begin;

do $rollback$
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
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'drop policy if exists crm_authenticated_access on public.%I',
        table_name
      );
      execute format('alter table public.%I disable row level security', table_name);
    end if;
  end loop;
end
$rollback$;

commit;
