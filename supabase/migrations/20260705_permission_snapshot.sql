create or replace function public.get_permission_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with current_account as (
    select
      u.id,
      u.auth_user_id,
      u.nome,
      u.email,
      u.ruolo,
      u.ruolo_id,
      u.sede,
      u.attivo,
      r.id as resolved_role_id,
      r.code as role_code,
      r.nome as role_name
    from public.utenti u
    left join lateral (
      select role.id, role.code, role.nome
      from public.ruoli role
      where role.id = u.ruolo_id
         or (
           u.ruolo_id is null
           and lower(role.code) = lower(u.ruolo)
         )
      order by (role.id = u.ruolo_id) desc
      limit 1
    ) r on true
    where u.auth_user_id = auth.uid()
       or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    order by (u.auth_user_id = auth.uid()) desc
    limit 1
  )
  select case
    when account.id is null then null
    else jsonb_build_object(
      'utente', jsonb_build_object(
        'id', account.id,
        'auth_user_id', account.auth_user_id,
        'nome', account.nome,
        'email', account.email,
        'ruolo', account.ruolo,
        'ruolo_id', account.ruolo_id,
        'sede', account.sede,
        'attivo', account.attivo
      ),
      'ruolo', jsonb_build_object(
        'id', account.resolved_role_id,
        'code', account.role_code,
        'nome', account.role_name
      ),
      'pages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'pagina', p.pagina,
          'accesso', p.accesso
        ))
        from public.permessi_pagina p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb),
      'records', coalesce((
        select jsonb_agg(jsonb_build_object(
          'modulo', p.modulo,
          'azione', p.azione,
          'abilitato', p.abilitato
        ))
        from public.permessi_record p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb),
      'ui', coalesce((
        select jsonb_agg(jsonb_build_object(
          'chiave', p.chiave,
          'abilitato', p.abilitato
        ))
        from public.permessi_ui p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'azione', p.azione,
          'abilitato', p.abilitato
        ))
        from public.permessi_azione p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb),
      'fields', coalesce((
        select jsonb_agg(jsonb_build_object(
          'modulo', p.modulo,
          'campo', p.campo,
          'accesso', p.accesso
        ))
        from public.permessi_campo p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb),
      'scopes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'risorsa', p.risorsa,
          'scope', p.scope
        ))
        from public.permessi_scope p
        where p.ruolo_id = account.resolved_role_id
      ), '[]'::jsonb)
    )
  end
  from (select 1) seed
  left join current_account account on true;
$$;

grant execute on function public.get_permission_snapshot() to authenticated;
