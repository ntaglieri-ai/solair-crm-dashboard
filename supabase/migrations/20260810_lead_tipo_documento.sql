alter table public.leads
  add column if not exists tipo_documento text;

alter table public.leads
  drop constraint if exists leads_tipo_documento_check;

alter table public.leads
  add constraint leads_tipo_documento_check
  check (
    tipo_documento is null
    or tipo_documento in ('preventivo', 'contratto')
  );

comment on column public.leads.tipo_documento is
  'Tipo documento richiesto dalla sorgente pubblica: preventivo o contratto.';
