-- Rollback di 20260823_crm_settings_write_policies.sql.
--
-- Ripristina la policy unica `crm_authenticated_access` come la creava
-- 20260820_enable_rls_legacy_crm_tables.sql, riaprendo la scrittura di TUTTE le
-- chiavi a qualunque utente autenticato — comprese max_login_attempts,
-- ip_block_enabled e session_timeout_minutes.
--
-- Da usare solo se la separazione per namespace blocca una scrittura
-- legittima che non era stata prevista.

begin;

drop policy if exists crm_settings_read on public.crm_settings;
drop policy if exists crm_settings_personal_insert on public.crm_settings;
drop policy if exists crm_settings_personal_update on public.crm_settings;
drop policy if exists crm_settings_config_insert on public.crm_settings;
drop policy if exists crm_settings_config_update on public.crm_settings;

drop policy if exists crm_authenticated_access on public.crm_settings;
create policy crm_authenticated_access
  on public.crm_settings
  for all
  to authenticated
  using (true)
  with check (true);

commit;

drop function if exists public.crm_settings_can_write_config();
