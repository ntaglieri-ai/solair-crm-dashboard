alter table public.offerta_commerciale_cataloghi
  add column if not exists codici_sconto jsonb not null default '[]'::jsonb;

comment on column public.offerta_commerciale_cataloghi.codici_sconto is
  'Codici sconto configurabili per il catalogo commerciale. Non applicati al calcolo finche non viene definita la regola di impatto.';
