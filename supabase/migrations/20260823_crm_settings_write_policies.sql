-- Sostituisce la policy `crm_authenticated_access` su public.crm_settings, che
-- concedeva ALL a `authenticated` con using(true)/with check(true).
--
-- Il problema: crm_settings contiene sia preferenze personali sia parametri di
-- sicurezza dell'intero CRM. Con una sola policy ALL, qualunque utente loggato
-- poteva riscrivere via PostgREST diretto:
--   * max_login_attempts      -> alzare la soglia e rendere inefficace il blocco
--   * ip_block_enabled        -> disattivare del tutto il blocco IP
--   * session_timeout_minutes -> allungare a piacere la sessione altrui
-- bypassando il gate `crm_settings.account.session`, che vive solo lato UI/API.
-- Il clamp applicato in lettura da lib/session-access/constants.ts limitava il
-- danno ai soli valori fuori intervallo, non l'accesso in scrittura.
--
-- Disegno: si separa per namespace, che nei dati reali cade esattamente sulla
-- linea giusta — la configurazione e' tutta prefissata (system. / company. /
-- maintenance.), le chiavi di sicurezza sono nomi piatti senza prefisso.
--
--   SELECT      -> invariato, aperto a authenticated. Necessario: spoki-client,
--                  handoff e personal-profile leggono con il client utente.
--   user.*      -> insert/update dal solo proprietario, legato ad auth.uid().
--                  Chiude anche il buco per cui chiunque poteva sovrascrivere
--                  le preferenze aspetto di un altro account.
--   system.*    |
--   company.*   |-> insert/update ai soli SUPERADMIN / ADMIN / DIRECTOR.
--   maintenance.|   DIRECTOR incluso perche' ha company.profile.edit,
--                  company.sites.manage e company.communication.manage nei
--                  default di lib/permissions/constants.ts.
--   tutto il resto (session_timeout_minutes, max_login_attempts,
--   ip_block_enabled, 2fa_enabled, branding_*, nextcloud_*, roberta.*)
--               -> nessuna policy di scrittura: solo service_role.
--
-- Nessuna regressione applicativa attesa: le tre chiavi di sicurezza e le due
-- chiavi roberta sono gia' scritte esclusivamente con service_role
-- (lib/session-access/security-settings.ts, app/api/crm-settings/roberta/
-- sources/route.ts, lib/roberta/sync-runner.ts), che ignora la RLS.
--
-- DELETE non viene concesso a nessuno: nessun punto del codice cancella righe
-- di crm_settings.


-- ---------------------------------------------------------------------------
-- BLOCCO 1 - funzione di controllo ruolo
-- ---------------------------------------------------------------------------
-- Stesso pattern di public.bacheca_can_manage() e nc_path_perms_can_write():
-- SECURITY DEFINER per non ricorrere nella RLS di `utenti`, e code/nome/ruolo in
-- coalesce perche' i ruoli custom non hanno sempre `code` valorizzato.

create or replace function public.crm_settings_can_write_config()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.utenti u
    left join public.ruoli r on r.id = u.ruolo_id
    where (
        u.auth_user_id = (select auth.uid())
        or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      )
      and upper(coalesce(r.code, r.nome, u.ruolo)) in ('SUPERADMIN', 'ADMIN', 'DIRECTOR')
  );
$$;

revoke all on function public.crm_settings_can_write_config() from public;
grant execute on function public.crm_settings_can_write_config() to authenticated;


-- ---------------------------------------------------------------------------
-- BLOCCO 2 - sostituzione delle policy
-- ---------------------------------------------------------------------------
-- Le chiamate a funzione sono wrappate in (select ...) cosi' Postgres le valuta
-- una volta per statement invece che per riga (regola fissa RLS del progetto).

begin;

alter table public.crm_settings enable row level security;

drop policy if exists crm_authenticated_access on public.crm_settings;

-- Lettura: invariata rispetto a prima.
drop policy if exists crm_settings_read on public.crm_settings;
create policy crm_settings_read
  on public.crm_settings
  for select
  to authenticated
  using (true);

-- Preferenze personali: solo le proprie due chiavi.
drop policy if exists crm_settings_personal_insert on public.crm_settings;
create policy crm_settings_personal_insert
  on public.crm_settings
  for insert
  to authenticated
  with check (
    chiave in (
      'user.appearance.' || (select auth.uid())::text,
      'user.profile.' || (select auth.uid())::text
    )
  );

drop policy if exists crm_settings_personal_update on public.crm_settings;
create policy crm_settings_personal_update
  on public.crm_settings
  for update
  to authenticated
  using (
    chiave in (
      'user.appearance.' || (select auth.uid())::text,
      'user.profile.' || (select auth.uid())::text
    )
  )
  with check (
    chiave in (
      'user.appearance.' || (select auth.uid())::text,
      'user.profile.' || (select auth.uid())::text
    )
  );

-- Configurazione aziendale: namespace prefissati, solo Director+.
drop policy if exists crm_settings_config_insert on public.crm_settings;
create policy crm_settings_config_insert
  on public.crm_settings
  for insert
  to authenticated
  with check (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
  );

drop policy if exists crm_settings_config_update on public.crm_settings;
create policy crm_settings_config_update
  on public.crm_settings
  for update
  to authenticated
  using (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
  )
  with check (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
  );

commit;


-- ---------------------------------------------------------------------------
-- BLOCCO 3 - verifica (sola lettura, non modifica niente)
-- ---------------------------------------------------------------------------
-- Atteso: 5 righe, nessuna con policyname = 'crm_authenticated_access',
-- tutte con roles = {authenticated}.

select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
  and tablename = 'crm_settings'
order by policyname;
