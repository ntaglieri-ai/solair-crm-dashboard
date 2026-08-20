-- Rollback di 20260820_harden_function_execute_privileges.sql.
--
-- ATTENZIONE: ripristina il privilegio EXECUTE implicito di PostgreSQL a
-- PUBLIC e, di conseguenza, riapre il rischio corretto dalla migrazione.
-- Eseguire solo per recuperare da una regressione confermata.

begin;

-- Le RPC dei segreti erano gia' state ristrette a service_role dalle rispettive
-- migrazioni originarie; il rollback conserva quella protezione.
revoke all on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.nextcloud_cred_get_password(uuid, text)
  from public, anon, authenticated;
revoke all on function public.email_cred_upsert(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.email_cred_get_password(uuid, text)
  from public, anon, authenticated;

grant execute on function public.pubblica_catalogo_offerta_commerciale(uuid)
  to public;

grant execute on function public.nc_path_perms_can_write() to public;
grant execute on function public.bacheca_can_manage() to public;
grant execute on function public.email_massa_current_utente() to public;

grant execute on function public.get_lead_stats() to public;
grant execute on function public.get_dashboard_aggregates() to public;
grant execute on function public.get_permission_snapshot() to public;

-- Mantiene anche i grant espliciti presenti prima dell'hardening.
grant execute on function public.nextcloud_cred_upsert(uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.nextcloud_cred_get_password(uuid, text)
  to service_role;
grant execute on function public.email_cred_upsert(uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.email_cred_get_password(uuid, text)
  to service_role;

-- Prima dell'hardening la RPC di pubblicazione era raggiungibile dalla
-- service role solo tramite PUBLIC, senza un grant diretto.
revoke execute on function public.pubblica_catalogo_offerta_commerciale(uuid)
  from service_role;

-- Ripristina lo stato precedente delle RPC schema: EXECUTE implicito a
-- PUBLIC, grant esplicito ad authenticated e nessun grant diretto service_role.
grant execute on function public.crm_admin_list_columns(text) to public;
grant execute on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean)
  to public;
grant execute on function public.crm_admin_drop_column(text, text) to public;
grant execute on function public.crm_admin_list_columns(text) to authenticated;
grant execute on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean)
  to authenticated;
grant execute on function public.crm_admin_drop_column(text, text) to authenticated;
revoke execute on function public.crm_admin_list_columns(text) from service_role;
revoke execute on function public.crm_admin_add_column(text, text, text, text, text, boolean, boolean)
  from service_role;
revoke execute on function public.crm_admin_drop_column(text, text) from service_role;

grant execute on function public.nc_path_perms_can_write() to authenticated;
grant execute on function public.bacheca_can_manage() to authenticated;
grant execute on function public.email_massa_current_utente() to authenticated;
grant execute on function public.get_lead_stats() to authenticated;
grant execute on function public.get_dashboard_aggregates() to authenticated;
grant execute on function public.get_permission_snapshot() to authenticated;

commit;
