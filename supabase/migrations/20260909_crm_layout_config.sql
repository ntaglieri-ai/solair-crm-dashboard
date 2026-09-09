-- Sistema di layout configurabile per le schede record (Clienti, Lead, ...).
--
-- Oggi la disposizione dei campi nella scheda e' scritta a mano nel codice
-- (i <DataField> dentro cliente-detail-content.tsx), mentre solo i campi
-- personalizzati di crm_custom_fields sono dinamici. Queste tabelle spostano
-- la DISPOSIZIONE — non lo storage — in configurazione, cosi' un admin puo'
-- spostare/rinominare/nascondere qualsiasi campo senza toccare il codice.
--
-- Confine deliberato: lo storage NON cambia. I campi di sistema restano
-- colonne tipizzate sulle loro tabelle (clienti.saldo, clienti.iban, ...) e
-- i personalizzati restano governati da crm_custom_fields. Qui si registra
-- soltanto DOVE un campo appare e COME si presenta. Nessun EAV.
--
-- Tre livelli, come su Zoho: pagina (macro-voce della navbar) -> blocco
-- (riquadro con titolo) -> campo (posizione dentro il riquadro).

begin;

-- ---------------------------------------------------------------------------
-- Pagine: le macro-voci della navbar della scheda ("Anagrafica", "Impianto").
-- ---------------------------------------------------------------------------
create table if not exists public.crm_layout_pagine (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  -- Stabile e non rinominabile: e' l'ancora usata dai link della navbar
  -- (#section-anagrafica) e dai riferimenti nel codice. La label invece e'
  -- libera e modificabile dall'admin.
  page_key text not null,
  label text not null,
  icona text,
  ordinamento integer not null default 0,
  visible boolean not null default true,
  -- Le pagine che rendono un componente dedicato invece di una griglia di
  -- campi (Allegati, Calendario, Attivita', Note interne). Restano nel
  -- layout — cosi' si riordinano e si nascondono come le altre — ma non
  -- accettano campi.
  componente text,
  created_by uuid references public.utenti(id) on delete set null,
  updated_by uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (modulo, page_key)
);

-- ---------------------------------------------------------------------------
-- Blocchi: i riquadri con titolo dentro una pagina ("Informazioni Clienti").
-- ---------------------------------------------------------------------------
create table if not exists public.crm_layout_blocchi (
  id uuid primary key default gen_random_uuid(),
  pagina_id uuid not null references public.crm_layout_pagine(id) on delete cascade,
  block_key text not null,
  label text not null,
  -- Un blocco senza label visibile serve per raggruppare campi senza
  -- introdurre un titolo in piu' nella pagina.
  mostra_titolo boolean not null default true,
  colonne smallint not null default 2 check (colonne between 1 and 4),
  ordinamento integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pagina_id, block_key)
);

-- ---------------------------------------------------------------------------
-- Campi: la posizione di un campo dentro un blocco.
--
-- origine = 'system'  -> field_key e' la chiave app del campo nativo
--                        ("Nome Clienti", "Saldo"), quella gia' usata da
--                        zoho-fields.ts / ClienteRecord.
-- origine = 'custom'  -> field_key corrisponde a crm_custom_fields.field_key.
--
-- Non c'e' FK verso crm_custom_fields di proposito: la stessa tabella deve
-- poter posizionare entrambe le origini con un meccanismo solo. La coerenza
-- e' verificata dall'applicazione, che conosce l'elenco delle chiavi valide
-- per ciascun modulo.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_layout_campi (
  id uuid primary key default gen_random_uuid(),
  blocco_id uuid not null references public.crm_layout_blocchi(id) on delete cascade,
  origine text not null check (origine in ('system', 'custom')),
  field_key text not null,
  -- Null = usa l'etichetta nativa del campo. Valorizzata = l'admin l'ha
  -- rinominata solo per la visualizzazione; la colonna sottostante non si
  -- muove.
  label_override text,
  ordinamento integer not null default 0,
  visible boolean not null default true,
  -- Larghezza in colonne della griglia del blocco: un campo lungo (una nota,
  -- una descrizione) puo' occupare tutta la riga.
  span smallint not null default 1 check (span between 1 and 4),
  -- Sola lettura in scheda anche quando il campo sarebbe scrivibile. I campi
  -- calcolati sono gia' di sola lettura per natura (vedi formula sotto):
  -- questo copre il caso di un campo normale che l'admin vuole congelare.
  sola_lettura boolean not null default false,
  -- Formattazione di presentazione (valuta, percentuale, decimali, ...).
  -- Non altera il valore salvato.
  formato jsonb not null default '{}'::jsonb,
  -- Campo calcolato: espressione tradotta dalle formule Zoho. Quando e'
  -- valorizzata il campo non e' scrivibile e il valore viene ricalcolato,
  -- mai inserito a mano. La valutazione e' dell'applicazione: qui si
  -- conserva solo la definizione.
  formula jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blocco_id, origine, field_key)
);

-- Nota: l'unique sulla tabella impedisce lo stesso campo due volte NELLO
-- STESSO blocco. Lo stesso campo in due blocchi diversi dello stesso modulo
-- mostrerebbe il dato due volte in scheda: quel vincolo attraversa
-- blocco -> pagina -> modulo e non e' esprimibile come unique semplice, per
-- cui lo verifica il backend prima di salvare, non il database.

create index if not exists crm_layout_blocchi_pagina_idx
  on public.crm_layout_blocchi (pagina_id, ordinamento);

create index if not exists crm_layout_campi_blocco_idx
  on public.crm_layout_campi (blocco_id, ordinamento);

create index if not exists crm_layout_pagine_modulo_idx
  on public.crm_layout_pagine (modulo, ordinamento)
  where visible = true;

-- ---------------------------------------------------------------------------
-- Ordine personale delle pagine.
--
-- Il layout (quali pagine esistono, cosa contengono) e' definito dall'admin
-- ed e' uguale per tutti. L'ORDINE in cui un utente le vede mentre lavora e'
-- invece una sua preferenza: chi passa la giornata sull'impianto se lo mette
-- per primo senza cambiare la scheda agli altri.
--
-- Righe assenti = ordine di default definito dall'admin.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_layout_ordine_utente (
  utente_id uuid not null references public.utenti(id) on delete cascade,
  modulo text not null,
  -- Elenco ordinato di page_key. Le pagine non elencate seguono in coda
  -- nell'ordine dell'admin, cosi' una pagina nuova compare a tutti anche se
  -- la preferenza e' stata salvata prima che esistesse.
  ordine jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (utente_id, modulo)
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lettura: aperta a tutti gli autenticati, come per crm_custom_fields — sono
-- metadata di presentazione (etichetta, posizione, formato), non dati dei
-- clienti. Senza lettura la scheda non saprebbe cosa disegnare.
--
-- Scrittura: nessuna policy. Passa dal backend con service_role, che
-- verifica il ruolo admin prima di toccare qualsiasi cosa.
-- ---------------------------------------------------------------------------
alter table public.crm_layout_pagine enable row level security;
alter table public.crm_layout_blocchi enable row level security;
alter table public.crm_layout_campi enable row level security;
alter table public.crm_layout_ordine_utente enable row level security;

create policy "crm_layout_pagine_select"
  on public.crm_layout_pagine
  for select
  to authenticated
  using (true);

create policy "crm_layout_blocchi_select"
  on public.crm_layout_blocchi
  for select
  to authenticated
  using (true);

create policy "crm_layout_campi_select"
  on public.crm_layout_campi
  for select
  to authenticated
  using (true);

-- L'ordine personale e' l'unica di queste tabelle che l'utente scrive da
-- solo, e solo la propria riga.
--
-- auth.uid() e' l'id dell'utente Supabase Auth, che NON coincide con
-- utenti.id: la corrispondenza passa da utenti.auth_user_id (stessa logica di
-- get_permission_snapshot). La sottoquery avvolge auth.uid() perche' venga
-- valutata una volta per query invece che per riga (vedi
-- 20260822_fix_advisor_warnings.sql).
create policy "crm_layout_ordine_utente_select_own"
  on public.crm_layout_ordine_utente
  for select
  to authenticated
  using (
    utente_id in (
      select u.id from public.utenti u
      where u.auth_user_id = (select auth.uid())
    )
  );

create policy "crm_layout_ordine_utente_upsert_own"
  on public.crm_layout_ordine_utente
  for insert
  to authenticated
  with check (
    utente_id in (
      select u.id from public.utenti u
      where u.auth_user_id = (select auth.uid())
    )
  );

create policy "crm_layout_ordine_utente_update_own"
  on public.crm_layout_ordine_utente
  for update
  to authenticated
  using (
    utente_id in (
      select u.id from public.utenti u
      where u.auth_user_id = (select auth.uid())
    )
  )
  with check (
    utente_id in (
      select u.id from public.utenti u
      where u.auth_user_id = (select auth.uid())
    )
  );

commit;
