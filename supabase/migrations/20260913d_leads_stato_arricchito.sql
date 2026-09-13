alter table public.leads
  add column if not exists stato_arricchito text;

comment on column public.leads.stato_arricchito is
  'Picklist Zoho Enrich Status, mostrata in CRM come Stato arricchito.';
