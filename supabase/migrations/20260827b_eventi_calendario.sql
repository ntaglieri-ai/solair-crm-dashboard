-- =====================================================================
-- Modulo Calendario.
--
-- Tabella di eventi a inserimento MANUALE. Non si autoalimenta da
-- leads/compiti/scadenze e non ha trigger che la sincronizzino: quelle
-- tabelle restano indipendenti, un evento e' un evento e basta. La
-- correlazione a un record e' opzionale e serve solo a filtrare il
-- calendario dalla scheda di quel record.
--
-- `categoria_id` punta alla configurazione in crm_settings
-- ('system.calendario.categorie'), non a una tabella: e' quindi text e
-- non ha FK. La conseguenza va conosciuta — cancellare una categoria
-- dalla config lascia gli eventi orfani: l'app li disegna con un
-- fallback neutro invece di nasconderli.
--
-- Permessi (RLS):
--   lettura  -> tutto lo staff interno autenticato;
--   scrittura-> solo il proprio record (creato_da = utente di sessione),
--               piu' SUPERADMIN / ADMIN / DIRECTOR su qualsiasi record.
-- =====================================================================

create table if not exists public.eventi_calendario (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  categoria_id text not null,
  -- NULL = eredita il colore di default della categoria. Un valore
  -- esplicito e' l'override manuale del singolo evento: distinguere i
  -- due casi con NULL, e non copiando il default alla creazione, fa si'
  -- che cambiare il colore della categoria ricolori gli eventi che non
  -- l'hanno mai sovrascritto.
  colore text,
  inizio timestamptz not null,
  fine timestamptz,
  note text,
  cliente_id uuid references public.clienti(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  installatore_id uuid references public.installatori(id) on delete set null,
  creato_da uuid not null references public.utenti(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventi_calendario_titolo_non_vuoto
    check (length(btrim(titolo)) > 0),
  constraint eventi_calendario_intervallo_valido
    check (fine is null or fine >= inizio),
  constraint eventi_calendario_colore_hex
    check (colore is null or colore ~* '^#[0-9a-f]{6}$')
);

-- La vista mensile/settimanale interroga sempre per intervallo di date.
create index if not exists eventi_calendario_inizio_idx
  on public.eventi_calendario (inizio);

-- Tre indici parziali invece di uno composito: le tre colonne sono
-- alternative fra loro (un evento e' collegato al massimo a un record) e
-- quasi sempre nulle, quindi gli indici restano piccoli.
create index if not exists eventi_calendario_cliente_idx
  on public.eventi_calendario (cliente_id, inizio) where cliente_id is not null;
create index if not exists eventi_calendario_lead_idx
  on public.eventi_calendario (lead_id, inizio) where lead_id is not null;
create index if not exists eventi_calendario_installatore_idx
  on public.eventi_calendario (installatore_id, inizio) where installatore_id is not null;

comment on table public.eventi_calendario is
  'Eventi di calendario a inserimento manuale. categoria_id referenzia crm_settings->system.calendario.categorie. Lettura a tutto lo staff, scrittura al solo autore (piu'' SUPERADMIN/ADMIN/DIRECTOR).';


-- ---------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------
-- has_full_row_visibility() e' gia' esattamente SUPERADMIN/ADMIN/DIRECTOR
-- (definita in DB, usata dalle policy di leads/clienti): riusata qui
-- invece di riscrivere la stessa lista, cosi' se la definizione dei
-- ruoli "che vedono tutto" cambia, il calendario la segue.
alter table public.eventi_calendario enable row level security;

drop policy if exists eventi_calendario_select on public.eventi_calendario;
create policy eventi_calendario_select
  on public.eventi_calendario for select to authenticated
  using (true);

drop policy if exists eventi_calendario_insert on public.eventi_calendario;
create policy eventi_calendario_insert
  on public.eventi_calendario for insert to authenticated
  with check (creato_da = (select public.current_utente_id()));

drop policy if exists eventi_calendario_update on public.eventi_calendario;
create policy eventi_calendario_update
  on public.eventi_calendario for update to authenticated
  using (
    creato_da = (select public.current_utente_id())
    or (select public.has_full_row_visibility())
  )
  -- with check identico allo using: senza, un autore potrebbe riassegnare
  -- `creato_da` a un altro utente e perdere il proprio evento.
  with check (
    creato_da = (select public.current_utente_id())
    or (select public.has_full_row_visibility())
  );

drop policy if exists eventi_calendario_delete on public.eventi_calendario;
create policy eventi_calendario_delete
  on public.eventi_calendario for delete to authenticated
  using (
    creato_da = (select public.current_utente_id())
    or (select public.has_full_row_visibility())
  );

grant select, insert, update, delete on public.eventi_calendario to authenticated;
revoke all on public.eventi_calendario from anon;


-- ---------------------------------------------------------------------
-- Configurazione categorie in crm_settings
-- ---------------------------------------------------------------------
-- Set iniziale, estendibile dal pannello. Gli id sono slug stabili: e' il
-- valore che finisce in eventi_calendario.categoria_id, quindi non va
-- rigenerato quando si rinomina una categoria.
insert into public.crm_settings (chiave, valore, descrizione, updated_at)
values (
  'system.calendario.categorie',
  '[
    {"id":"lead",          "nome":"Lead",         "colore":"#3b82f6"},
    {"id":"cliente",       "nome":"Cliente",      "colore":"#2e8b72"},
    {"id":"installazione", "nome":"Installazione","colore":"#f59e0b"},
    {"id":"compito",       "nome":"Compito",      "colore":"#8b5cf6"},
    {"id":"scadenza",      "nome":"Scadenza",     "colore":"#dc2626"}
  ]'::jsonb,
  'Categorie del modulo Calendario: nome e colore di default. Gestibile da SUPERADMIN/ADMIN.',
  now()
)
on conflict (chiave) do nothing;


-- ---------------------------------------------------------------------
-- Stretta sulla scrittura della chiave categorie
-- ---------------------------------------------------------------------
-- crm_settings_config_insert/update (20260823) concedono l'intero
-- namespace system.* anche a DIRECTOR. Le categorie del calendario devono
-- essere gestibili da SUPERADMIN/ADMIN soltanto, e le policy permissive
-- si sommano in OR: non basta aggiungerne una piu' stretta, va ristretta
-- quella esistente. Il resto di system.*/company.*/maintenance.* resta
-- identico a prima.
begin;

drop policy if exists crm_settings_config_insert on public.crm_settings;
create policy crm_settings_config_insert
  on public.crm_settings
  for insert
  to authenticated
  with check (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
    and (
      chiave <> 'system.calendario.categorie'
      or (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    )
  );

drop policy if exists crm_settings_config_update on public.crm_settings;
create policy crm_settings_config_update
  on public.crm_settings
  for update
  to authenticated
  using (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
    and (
      chiave <> 'system.calendario.categorie'
      or (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    )
  )
  with check (
    (
      chiave like 'system.%'
      or chiave like 'company.%'
      or chiave like 'maintenance.%'
    )
    and (select public.crm_settings_can_write_config())
    and (
      chiave <> 'system.calendario.categorie'
      or (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    )
  );

commit;
