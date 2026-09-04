begin;

-- Stop safely if historical duplicates need manual review; never delete them.
do $$ begin
  if exists (select 1 from public.clienti where lead_id is not null group by lead_id having count(*) > 1) then
    raise exception 'Clienti duplicati per lead_id: revisione manuale necessaria';
  end if;
end $$;
create unique index if not exists clienti_unique_converted_lead
  on public.clienti (lead_id) where lead_id is not null;

-- Backend only. NULL scope = all; empty array = none. Checks run under lock.
create or replace function public.crm_convert_lead_atomic(
  p_lead_id uuid, p_lead_owner_ids uuid[], p_cliente_owner_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_lead public.leads%rowtype;
  v_cliente public.clienti%rowtype;
  v_cliente_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Lead non trovato'; end if;
  if p_lead_owner_ids is not null and not coalesce(v_lead.lead_proprietario_id = any(p_lead_owner_ids), false) then
    raise exception using errcode = '42501', message = 'Lead fuori perimetro';
  end if;
  if v_lead.stato_lead = 'Convertito' or v_lead.account_convertito_id is not null then
    raise exception using errcode = '23505', message = 'Lead gia convertito';
  end if;
  select * into v_cliente from public.clienti where lead_id = p_lead_id for update;
  if found then
    if p_cliente_owner_ids is not null and not coalesce(v_cliente.clienti_proprietario_id = any(p_cliente_owner_ids), false) then
      raise exception using errcode = '42501', message = 'Cliente fuori perimetro';
    end if;
    v_cliente_id := v_cliente.id;
  else
    if p_cliente_owner_ids is not null and not coalesce(v_lead.lead_proprietario_id = any(p_cliente_owner_ids), false) then
      raise exception using errcode = '42501', message = 'Proprietario cliente fuori perimetro';
    end if;
    insert into public.clienti (nome_clienti, nome, cognome, email, cellulare,
      sede, clienti_proprietario_id, provincia_indirizzo_postale, lead_id)
    values (v_lead.nome_lead, v_lead.nome, v_lead.cognome, v_lead.email, v_lead.telefono,
      v_lead.sede, v_lead.lead_proprietario_id, v_lead.provincia, v_lead.id)
    returning id into v_cliente_id;
  end if;
  update public.leads set stato_lead = 'Convertito', account_convertito_id = v_cliente_id,
    updated_at = now() where id = p_lead_id;
  return v_cliente_id;
end;
$$;
revoke all on function public.crm_convert_lead_atomic(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.crm_convert_lead_atomic(uuid, uuid[], uuid[]) to service_role;
notify pgrst, 'reload schema';
commit;
