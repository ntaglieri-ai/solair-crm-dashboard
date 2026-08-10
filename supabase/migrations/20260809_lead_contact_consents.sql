alter table public.leads
  add column if not exists consenso_contatto_telefono boolean not null default false,
  add column if not exists consenso_contatto_whatsapp boolean not null default false,
  add column if not exists consenso_contatto_email boolean not null default false;

comment on column public.leads.consenso_contatto_telefono is
  'Consenso esplicito del lead a essere ricontattato telefonicamente.';
comment on column public.leads.consenso_contatto_whatsapp is
  'Consenso esplicito del lead a essere ricontattato via WhatsApp.';
comment on column public.leads.consenso_contatto_email is
  'Consenso esplicito del lead a essere ricontattato via email.';
