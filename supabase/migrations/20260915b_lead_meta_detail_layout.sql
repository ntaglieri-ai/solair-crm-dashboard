begin;
-- Add only missing native fields next to campaign name; preserve admin placements.
do $$
declare
  anchor record;
  field_name text;
  offset_value integer := 0;
begin
  select f.blocco_id, f.ordinamento into anchor
  from public.crm_layout_campi f
  join public.crm_layout_blocchi b on b.id = f.blocco_id
  join public.crm_layout_pagine p on p.id = b.pagina_id
  where p.modulo = 'lead' and f.origine = 'system' and f.field_key = 'campaign name'
  order by p.ordinamento, b.ordinamento, f.id limit 1;
  if not found then return; end if;
  foreach field_name in array array['Ad Meta', 'Adset Meta'] loop
    if not exists (
      select 1 from public.crm_layout_campi f
      join public.crm_layout_blocchi b on b.id = f.blocco_id
      join public.crm_layout_pagine p on p.id = b.pagina_id
      where p.modulo = 'lead' and f.origine = 'system' and f.field_key = field_name
    ) then
      offset_value := offset_value + 1;
      update public.crm_layout_campi set ordinamento = ordinamento + 1
      where blocco_id = anchor.blocco_id and ordinamento >= anchor.ordinamento + offset_value;
      insert into public.crm_layout_campi (blocco_id, origine, field_key, ordinamento)
      values (anchor.blocco_id, 'system', field_name, anchor.ordinamento + offset_value);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
