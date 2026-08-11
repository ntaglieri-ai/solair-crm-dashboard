alter table public.offerta_commerciale_offerte
  add column if not exists tipo text not null default 'offerta',
  add column if not exists url_pubblico text;

alter table public.offerta_commerciale_offerte
  drop constraint if exists offerta_commerciale_offerte_tipo_check;

alter table public.offerta_commerciale_offerte
  add constraint offerta_commerciale_offerte_tipo_check
  check (tipo in ('offerta', 'locandina', 'brochure', 'finanziaria', 'pagina'));

comment on column public.offerta_commerciale_offerte.url_pubblico is
  'URL pubblico del sito/Sanity da condividere con Roberta o con il sito.';
