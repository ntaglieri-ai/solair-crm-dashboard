-- Seconda cintura di sicurezza per il perimetro dati configurato in Permissions.
-- Le policy preesistenti restano responsabili delle capacita' CRUD; queste
-- policy RESTRICTIVE impediscono comunque di leggere o mutare record fuori
-- dal proprio scope, anche usando direttamente PostgREST/Supabase.

begin;

create or replace function public.crm_current_user_can_access_owner(
  p_resource text,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      u.id,
      u.ruolo_id,
      upper(coalesce(r.code, r.nome, u.ruolo, 'STANDARD')) as role_code
    from public.utenti u
    left join public.ruoli r on r.id = u.ruolo_id
    where u.auth_user_id = (select auth.uid())
       or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    order by (u.auth_user_id = (select auth.uid())) desc
    limit 1
  ), resolved as (
    select
      me.*,
      coalesce(
        (
          select split_part(p.chiave, ':', 3)
          from public.permessi_ui p
          where p.ruolo_id = me.ruolo_id
            and p.abilitato is true
            and p.chiave like ('scope:' || p_resource || ':%')
          limit 1
        ),
        case
          when me.role_code in ('SUPERADMIN', 'ADMIN') then 'all'
          when me.role_code = 'DIRECTOR' then 'team'
          when me.role_code = 'AGENT' then 'assigned'
          else 'none'
        end
      ) as data_scope
    from me
  )
  select coalesce(
    (
      select case
        when resolved.role_code = 'SUPERADMIN' or resolved.data_scope = 'all' then true
        when resolved.data_scope in ('own', 'assigned', 'own_sede')
          then p_owner_id = resolved.id
        when resolved.data_scope = 'team' then
          p_owner_id = resolved.id
          or exists (
            select 1
            from public.team_direttori td
            join public.team_agenti ta on ta.team_id = td.team_id
            where td.utente_id = resolved.id
              and ta.utente_id = p_owner_id
          )
        else false
      end
      from resolved
    ),
    false
  );
$$;

revoke all on function public.crm_current_user_can_access_owner(text, uuid) from public;
revoke execute on function public.crm_current_user_can_access_owner(text, uuid) from anon;
grant execute on function public.crm_current_user_can_access_owner(text, uuid) to authenticated;

do $$
declare
  item record;
  command text;
begin
  for item in
    select *
    from (values
      ('leads', 'lead', 'lead_proprietario_id'),
      ('clienti', 'clienti', 'clienti_proprietario_id'),
      ('compiti', 'compiti', 'proprietario_id'),
      ('scadenze', 'scadenze', 'proprietario_id'),
      ('installatori', 'installatori', 'proprietario_id')
    ) as scope_map(table_name, resource_name, owner_column)
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      item.table_name || '_configured_scope_select',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for select to authenticated using (public.crm_current_user_can_access_owner(%L, %I))',
      item.table_name || '_configured_scope_select',
      item.table_name,
      item.resource_name,
      item.owner_column
    );

    execute format(
      'drop policy if exists %I on public.%I',
      item.table_name || '_configured_scope_update',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (public.crm_current_user_can_access_owner(%L, %I)) with check (public.crm_current_user_can_access_owner(%L, %I))',
      item.table_name || '_configured_scope_update',
      item.table_name,
      item.resource_name,
      item.owner_column,
      item.resource_name,
      item.owner_column
    );

    execute format(
      'drop policy if exists %I on public.%I',
      item.table_name || '_configured_scope_delete',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (public.crm_current_user_can_access_owner(%L, %I))',
      item.table_name || '_configured_scope_delete',
      item.table_name,
      item.resource_name,
      item.owner_column
    );

    execute format(
      'drop policy if exists %I on public.%I',
      item.table_name || '_configured_scope_insert',
      item.table_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check (public.crm_current_user_can_access_owner(%L, %I))',
      item.table_name || '_configured_scope_insert',
      item.table_name,
      item.resource_name,
      item.owner_column
    );
  end loop;
end
$$;

commit;
