alter table public.offerta_commerciale_offerte
  add column if not exists testo_estratto text,
  add column if not exists testo_fingerprint text,
  add column if not exists testo_estratto_at timestamptz;

comment on column public.offerta_commerciale_offerte.testo_estratto is
  'Testo estratto automaticamente dal PDF offerta/locandina per Roberta.';
