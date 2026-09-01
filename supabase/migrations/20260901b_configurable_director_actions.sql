-- I ruoli duplicati/configurabili devono ereditare le capacita' del Direttore
-- tramite permessi_azione, senza dipendere dal codice letterale DIRECTOR.

create or replace function public.crm_current_user_can_action(
  p_action text,
  p_default_roles text[] default array[]::text[]
)
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
    where u.auth_user_id = (select auth.uid())
       or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
    limit 1
  )
  select coalesce(
    (
      select pa.abilitato
      from public.permessi_azione pa
      join me on me.ruolo_id = pa.ruolo_id
      where pa.azione = p_action
    ),
    (select me.role_code = any(p_default_roles) from me),
    false
  );
$$;

revoke all on function public.crm_current_user_can_action(text, text[]) from public;
revoke execute on function public.crm_current_user_can_action(text, text[]) from anon;
grant execute on function public.crm_current_user_can_action(text, text[]) to authenticated;

create or replace function public.note_interne_can_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_current_user_can_action(
    'clienti.note_interne.view',
    array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
  );
$$;

drop policy if exists eventi_calendario_update on public.eventi_calendario;
create policy eventi_calendario_update
  on public.eventi_calendario for update to authenticated
  using (
    creato_da = (select public.current_utente_id())
    or (select public.crm_current_user_can_action(
      'calendario.events.manage_all',
      array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
    ))
  )
  with check (
    creato_da = (select public.current_utente_id())
    or (select public.crm_current_user_can_action(
      'calendario.events.manage_all',
      array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
    ))
  );

drop policy if exists eventi_calendario_delete on public.eventi_calendario;
create policy eventi_calendario_delete
  on public.eventi_calendario for delete to authenticated
  using (
    creato_da = (select public.current_utente_id())
    or (select public.crm_current_user_can_action(
      'calendario.events.manage_all',
      array['SUPERADMIN', 'ADMIN', 'DIRECTOR']
    ))
  );
