-- Stato Cliente diventa una lista configurabile invece di un elenco fisso
-- nel codice (StatoCliente in mock-data.ts): stesso motivo dei Tag e dei
-- Campi personalizzati — aggiungere un nuovo stato non deve richiedere un
-- deploy. Seedata con gli 11 valori REALI della tendina Zoho (screenshot
-- Nando, 04/09), non piu' i 9 inventati che non combaciavano coi dati.
create table if not exists public.crm_stato_cliente (
  id uuid primary key default gen_random_uuid(),
  valore text not null unique,
  tono text not null default 'muted'
    check (tono in ('muted', 'success', 'warning', 'info', 'teal', 'destructive')),
  ordinamento integer not null default 0,
  attivo boolean not null default true,
  creato_da uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.crm_stato_cliente enable row level security;

-- Lettura: chiunque sia autenticato (serve per popolare filtro/tendine).
-- Scrittura: solo utenti con permesso di gestione schema — stessa logica
-- di crm_custom_fields, tramite la route API, non un ruolo Postgres diverso.
create policy "crm_stato_cliente_select_authenticated"
  on public.crm_stato_cliente
  for select
  to authenticated
  using (attivo = true);

insert into public.crm_stato_cliente (valore, tono, ordinamento) values
  ('Concluso', 'success', 1),
  ('Da installare', 'warning', 2),
  ('Da sollecitare', 'destructive', 3),
  ('In Esecuzione', 'teal', 4),
  ('In stand-by', 'muted', 5),
  ('Installato', 'success', 6),
  ('Logistica', 'info', 7),
  ('Necessario sopralluogo/intervento', 'warning', 8),
  ('Negativo', 'destructive', 9),
  ('Sollecitato', 'warning', 10),
  ('Validato', 'info', 11)
on conflict (valore) do nothing;
