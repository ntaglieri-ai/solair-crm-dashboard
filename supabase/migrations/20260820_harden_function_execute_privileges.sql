-- Hardening RPC esposte da PostgREST.
--
-- PostgreSQL concede EXECUTE su una nuova funzione a PUBLIC per default.
-- Un GRANT successivo al solo ruolo desiderato non rimuove quel privilegio:
-- occorre revocarlo esplicitamente. Questo e' particolarmente critico per le
-- funzioni SECURITY DEFINER, che eseguono con i privilegi del proprietario.

begin;

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
