begin;

-- Lead attribution is a prerequisite already used by the Meta webhook.
alter table public.leads
  add column if not exists meta_campaign_id text,
  add column if not exists meta_campaign_name text,
  add column if not exists meta_adset_id text,
  add column if not exists meta_adset_name text,
  add column if not exists meta_ad_id text,
  add column if not exists meta_ad_name text,
  add column if not exists meta_form_id text;

alter table public.clienti
  add column if not exists campaign_name text,
  add column if not exists meta_campaign_id text,
  add column if not exists meta_campaign_name text,
  add column if not exists meta_adset_id text,
  add column if not exists meta_adset_name text,
  add column if not exists meta_ad_id text,
  add column if not exists meta_ad_name text,
  add column if not exists meta_form_id text;

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
  -- Copy attribution for both newly inserted and pre-existing linked customers.
  update public.clienti set
    campaign_name = coalesce(campaign_name, v_lead.campaign_name),
    meta_campaign_id = coalesce(meta_campaign_id, v_lead.meta_campaign_id),
    meta_campaign_name = coalesce(meta_campaign_name, v_lead.meta_campaign_name),
    meta_adset_id = coalesce(meta_adset_id, v_lead.meta_adset_id),
    meta_adset_name = coalesce(meta_adset_name, v_lead.meta_adset_name),
    meta_ad_id = coalesce(meta_ad_id, v_lead.meta_ad_id),
    meta_ad_name = coalesce(meta_ad_name, v_lead.meta_ad_name),
    meta_form_id = coalesce(meta_form_id, v_lead.meta_form_id)
  where id = v_cliente_id;
  update public.leads set stato_lead = 'Convertito', account_convertito_id = v_cliente_id,
    updated_at = now() where id = p_lead_id;
  return v_cliente_id;
end;
$$;
revoke all on function public.crm_convert_lead_atomic(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.crm_convert_lead_atomic(uuid, uuid[], uuid[]) to service_role;

-- Only explicit lead_id links: never guess by name, phone or email.
update public.clienti c set
  campaign_name = coalesce(c.campaign_name, l.campaign_name),
  meta_campaign_id = coalesce(c.meta_campaign_id, l.meta_campaign_id),
  meta_campaign_name = coalesce(c.meta_campaign_name, l.meta_campaign_name),
  meta_adset_id = coalesce(c.meta_adset_id, l.meta_adset_id),
  meta_adset_name = coalesce(c.meta_adset_name, l.meta_adset_name),
  meta_ad_id = coalesce(c.meta_ad_id, l.meta_ad_id),
  meta_ad_name = coalesce(c.meta_ad_name, l.meta_ad_name),
  meta_form_id = coalesce(c.meta_form_id, l.meta_form_id)
from public.leads l
where c.lead_id = l.id
  and ((c.campaign_name is null and l.campaign_name is not null)
    or (c.meta_campaign_id is null and l.meta_campaign_id is not null)
    or (c.meta_campaign_name is null and l.meta_campaign_name is not null)
    or (c.meta_adset_id is null and l.meta_adset_id is not null)
    or (c.meta_adset_name is null and l.meta_adset_name is not null)
    or (c.meta_ad_id is null and l.meta_ad_id is not null)
    or (c.meta_ad_name is null and l.meta_ad_name is not null)
    or (c.meta_form_id is null and l.meta_form_id is not null));

-- Append to the configured customer block containing the lead origin.
-- Preserve existing positions and do not duplicate fields placed by an admin.
with anchor as (
  select b.id from public.crm_layout_blocchi b
  join public.crm_layout_pagine p on p.id = b.pagina_id
  join public.crm_layout_campi f on f.blocco_id = b.id
  where p.modulo = 'clienti' and f.origine = 'system' and f.field_key = 'Origine Lead'
  order by p.ordinamento, b.ordinamento, b.id limit 1
), new_fields(field_key, position) as (
  values ('Ad Meta', 1), ('Adset Meta', 2)
)
insert into public.crm_layout_campi (blocco_id, origine, field_key, ordinamento)
select a.id, 'system', n.field_key,
  coalesce((select max(ordinamento) from public.crm_layout_campi where blocco_id = a.id), 0) + n.position
from anchor a cross join new_fields n
where not exists (
  select 1 from public.crm_layout_campi f
  join public.crm_layout_blocchi b on b.id = f.blocco_id
  join public.crm_layout_pagine p on p.id = b.pagina_id
  where p.modulo = 'clienti' and f.origine = 'system' and f.field_key = n.field_key
);

notify pgrst, 'reload schema';
commit;
