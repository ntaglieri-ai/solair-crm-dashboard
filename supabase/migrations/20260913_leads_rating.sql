alter table public.leads
  add column if not exists rating text;

comment on column public.leads.rating is
  'Picklist Zoho Rating, mostrata in CRM come Valutazione. La colonna valutazione resta lo score numerico 0-100.';
