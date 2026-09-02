-- Menzioni strutturate nelle note della timeline. JSONB mantiene compatibili
-- tutte le note storiche e conserva l'id dell'utente anche in caso di omonimi.
alter table public.attivita
  add column if not exists menzioni jsonb not null default '[]'::jsonb;

alter table public.attivita
  add constraint attivita_menzioni_array_check
  check (jsonb_typeof(menzioni) = 'array');
