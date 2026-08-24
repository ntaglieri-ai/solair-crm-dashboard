-- Sostituisce la policy `crm_authenticated_access` su public.ruoli,
-- public.permessi_pagina, public.permessi_record e public.permessi_azione, che
-- concedeva ALL a `authenticated` con using(true)/with check(true).
--
-- Il problema: sono le quattro tabelle che *definiscono* i permessi del CRM.
-- Con una sola policy ALL, qualunque utente loggato poteva, via PostgREST
-- diretto e senza passare da nessuna route:
--   * update permessi_pagina  -> darsi accesso 'rw' a crm_settings.account
--   * update permessi_record  -> darsi delete/export su lead e clienti
--   * insert ruoli            -> creare un ruolo su misura
--   * update permessi_azione  -> concedersi crm_settings.account.roles.manage
-- cioe' riscrivere la propria autorizzazione. Il gate applicativo
-- `crm_settings.account.roles.manage` vive solo in requireApiAction
-- (app/api/crm-settings/permessi/route.ts) e non protegge la tabella.
--
-- Disegno: SELECT resta aperta, la scrittura passa dallo stesso permesso che
-- l'API gia' pretende.
--
--   SELECT  -> invariato, aperto a authenticated. Necessario: la risoluzione
--              dei permessi legge queste tabelle con il client utente
--              (lib/permissions/load-permissions.ts, lib/crm-settings/roles.ts,
--              lib/nextcloud/path-permissions.ts, le pagine di CRM Settings).
--   INSERT/UPDATE su permessi_* e INSERT su ruoli
--           -> solo chi ha crm_settings.account.roles.manage, valutato in DB
--              con la stessa regola dell'app (riga in permessi_azione se c'e',
--              altrimenti il default del ruolo: SUPERADMIN e ADMIN).
--   UPDATE/DELETE su ruoli, DELETE su permessi_*
--           -> nessuna policy: solo service_role. Nessun punto del codice
--              rinomina o cancella un ruolo, ne' cancella righe di permessi:
--              savePermissions fa solo upsert (l'unica delete e' su
--              permessi_campo, tabella fuori da questa migration).
--
-- Le scritture legittime restano possibili: POST/PATCH di
-- app/api/crm-settings/permessi/route.ts usano il client utente
-- (lib/supabase/server), non service_role, quindi passano dalla RLS — ed e' il
-- motivo per cui qui non si puo' chiudere a service_role-only come si e' fatto
-- ieri per le chiavi di sicurezza di crm_settings.
--
-- Nota su permessi_azione: oggi nessuna scrittura applicativa la raggiunge.
-- savePermissions esce prima (return anticipato quando permessi_ui non ha
-- righe per il ruolo, e permessi_ui ha RLS attiva con zero policy). La policy
-- qui sotto e' quindi inerte finche' quel percorso non viene riparato: la
-- scrivo lo stesso perche' il buco in scrittura diretta e' reale adesso.


-- ---------------------------------------------------------------------------
-- BLOCCO 1 - funzione di controllo permesso
-- ---------------------------------------------------------------------------
-- Stesso pattern di public.crm_settings_can_write_config(): SECURITY DEFINER
-- per non ricorrere nella RLS di `utenti` (e, qui, in quella di permessi_azione
-- e ruoli), e code/nome/ruolo in coalesce perche' i ruoli custom non hanno
-- sempre `code` valorizzato.
--
-- Rispetto a ieri la funzione non si ferma alla lista di ruoli: replica
-- l'ordine di risoluzione di lib/permissions/load-permissions.ts, dove la riga
-- di permessi_azione sovrascrive il default del ruolo. Cosi' un ruolo custom a
-- cui un admin conceda "Gestisce ruoli" dalla UI passa anche la RLS, invece di
-- superare il guard API e sbattere su un errore muto in scrittura.

create or replace function public.permessi_can_manage_roles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      u.ruolo_id,
      upper(coalesce(r.code, r.nome, u.ruolo)) as role_code
    from public.utenti u
    left join public.ruoli r on r.id = u.ruolo_id
    where (
        u.auth_user_id = (select auth.uid())
        or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      )
    limit 1
  )
  select coalesce(
    -- 1. override esplicito in permessi_azione, se esiste
    (
      select pa.abilitato
      from public.permessi_azione pa
      join me on me.ruolo_id = pa.ruolo_id
      where pa.azione = 'crm_settings.account.roles.manage'
    ),
    -- 2. altrimenti il default del ruolo (lib/permissions/constants.ts)
    (select me.role_code in ('SUPERADMIN', 'ADMIN') from me),
    -- 3. nessun utente risolto
    false
  );
$$;

revoke all on function public.permessi_can_manage_roles() from public;
grant execute on function public.permessi_can_manage_roles() to authenticated;


-- ---------------------------------------------------------------------------
-- BLOCCO 2 - policy su public.ruoli
-- ---------------------------------------------------------------------------
-- Le chiamate a funzione sono wrappate in (select ...) cosi' Postgres le valuta
-- una volta per statement invece che per riga (regola fissa RLS del progetto).

-- Le default privileges di Supabase concedono execute ad `anon` sulle funzioni
-- di public: `revoke ... from public` del blocco 1 non le tocca. Per anon la
-- funzione ritorna comunque false (nessun utente risolto) e le policy sono
-- `to authenticated`, ma il grant non serve a niente e va tolto.
revoke execute on function public.permessi_can_manage_roles() from anon;

begin;

alter table public.ruoli enable row level security;

drop policy if exists crm_authenticated_access on public.ruoli;

-- Lettura: invariata rispetto a prima.
drop policy if exists ruoli_read on public.ruoli;
create policy ruoli_read
  on public.ruoli
  for select
  to authenticated
  using (true);

-- Creazione di un ruolo custom: solo chi gestisce i ruoli, e mai marcato come
-- ruolo di sistema. `sistema` distingue i ruoli non cancellabili dalla UI:
-- l'API lo imposta sempre a false, non c'e' motivo perche' una insert lo alzi.
-- (Il travestimento da ruolo predefinito e' gia' impedito da ruoli_code_key,
-- unique su `code`: un secondo 'SUPERADMIN' non entra.)
drop policy if exists ruoli_manager_insert on public.ruoli;
create policy ruoli_manager_insert
  on public.ruoli
  for insert
  to authenticated
  with check (
    (select public.permessi_can_manage_roles())
    and coalesce(sistema, false) = false
  );

-- Nessuna policy di UPDATE o DELETE: nessun percorso applicativo rinomina o
-- cancella un ruolo. Se domani la UI aggiunge la rinomina, va aggiunta qui una
-- policy di update esplicita — il fallimento sara' visibile, non silenzioso.

commit;


-- ---------------------------------------------------------------------------
-- BLOCCO 3 - policy sulle tre tabelle dei permessi
-- ---------------------------------------------------------------------------
-- savePermissions() fa upsert: servono sia INSERT (with check) sia UPDATE
-- (using + with check). DELETE resta a nessuno: quel codice non cancella mai
-- righe da queste tabelle, e la pulizia dei permessi di un ruolo eliminato
-- avviene gia' da sola via FOREIGN KEY ... ON DELETE CASCADE.

begin;

alter table public.permessi_pagina enable row level security;
alter table public.permessi_record enable row level security;
alter table public.permessi_azione enable row level security;

drop policy if exists crm_authenticated_access on public.permessi_pagina;
drop policy if exists crm_authenticated_access on public.permessi_record;
drop policy if exists crm_authenticated_access on public.permessi_azione;

-- permessi_pagina ------------------------------------------------------------
drop policy if exists permessi_pagina_read on public.permessi_pagina;
create policy permessi_pagina_read
  on public.permessi_pagina
  for select
  to authenticated
  using (true);

drop policy if exists permessi_pagina_manager_insert on public.permessi_pagina;
create policy permessi_pagina_manager_insert
  on public.permessi_pagina
  for insert
  to authenticated
  with check ((select public.permessi_can_manage_roles()));

drop policy if exists permessi_pagina_manager_update on public.permessi_pagina;
create policy permessi_pagina_manager_update
  on public.permessi_pagina
  for update
  to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

-- permessi_record ------------------------------------------------------------
drop policy if exists permessi_record_read on public.permessi_record;
create policy permessi_record_read
  on public.permessi_record
  for select
  to authenticated
  using (true);

drop policy if exists permessi_record_manager_insert on public.permessi_record;
create policy permessi_record_manager_insert
  on public.permessi_record
  for insert
  to authenticated
  with check ((select public.permessi_can_manage_roles()));

drop policy if exists permessi_record_manager_update on public.permessi_record;
create policy permessi_record_manager_update
  on public.permessi_record
  for update
  to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

-- permessi_azione ------------------------------------------------------------
drop policy if exists permessi_azione_read on public.permessi_azione;
create policy permessi_azione_read
  on public.permessi_azione
  for select
  to authenticated
  using (true);

drop policy if exists permessi_azione_manager_insert on public.permessi_azione;
create policy permessi_azione_manager_insert
  on public.permessi_azione
  for insert
  to authenticated
  with check ((select public.permessi_can_manage_roles()));

drop policy if exists permessi_azione_manager_update on public.permessi_azione;
create policy permessi_azione_manager_update
  on public.permessi_azione
  for update
  to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

commit;


-- ---------------------------------------------------------------------------
-- BLOCCO 4 - verifica (sola lettura, non modifica niente)
-- ---------------------------------------------------------------------------
-- Tre controlli, da leggere insieme.

-- 4a. Elenco completo. Atteso: 10 righe, tutte roles = {authenticated},
--     nessuna con policyname = 'crm_authenticated_access', nessuna con
--     cmd = 'DELETE', e per `ruoli` solo ruoli_read + ruoli_manager_insert.
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('ruoli', 'permessi_pagina', 'permessi_record', 'permessi_azione')
order by tablename, policyname;

-- 4b. Semaforo. Atteso: una riga per tabella, tutte con esito 'OK'.
select
  t.tablename,
  count(*) filter (where p.policyname = 'crm_authenticated_access') as residui,
  count(*) filter (where p.roles::text <> '{authenticated}')        as ruoli_sbagliati,
  count(*) filter (where p.cmd = 'DELETE')                          as delete_aperte,
  count(*)                                                          as policy_totali,
  case
    when count(*) filter (where p.policyname = 'crm_authenticated_access') > 0 then 'FALLITO: crm_authenticated_access ancora presente'
    when count(*) filter (where p.roles::text <> '{authenticated}') > 0       then 'FALLITO: policy concessa a un ruolo diverso da authenticated'
    when count(*) filter (where p.cmd = 'DELETE') > 0                         then 'FALLITO: esiste una policy di DELETE'
    when t.tablename = 'ruoli' and count(*) <> 2                              then 'FALLITO: ruoli deve avere esattamente 2 policy'
    when t.tablename <> 'ruoli' and count(*) <> 3                             then 'FALLITO: le tabelle permessi_* devono avere 3 policy'
    else 'OK'
  end as esito
from (
  values ('ruoli'), ('permessi_pagina'), ('permessi_record'), ('permessi_azione')
) as t(tablename)
left join pg_policies p
  on p.schemaname = 'public' and p.tablename = t.tablename
group by t.tablename
order by t.tablename;

-- 4c. RLS attiva davvero. Atteso: relrowsecurity = true su tutte e quattro.
--     Senza questo, delle policy corrette non proteggono niente.
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('ruoli', 'permessi_pagina', 'permessi_record', 'permessi_azione')
order by c.relname;
