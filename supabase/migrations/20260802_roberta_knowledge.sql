-- Memoria veloce per Roberta.
--
-- Nextcloud resta l'archivio dei documenti originali; queste tabelle sono una
-- rappresentazione derivata e leggera, pronta per la chat del sito.

begin;

create table if not exists public.roberta_knowledge_sources (
  source_key text primary key,
  nome text not null,
  cartella text not null,
  fingerprint text not null,
  stato text not null default 'ready'
    check (stato in ('ready', 'scan_pending', 'empty', 'error')),
  testo_chars integer not null default 0,
  errore text,
  synced_at timestamptz not null default now()
);

create table if not exists public.roberta_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.roberta_knowledge_sources(source_key) on delete cascade,
  chunk_index integer not null,
  categoria text not null,
  titolo text not null,
  contenuto text not null,
  keywords text[] not null default '{}',
  aggiornato_at timestamptz not null default now(),
  unique (source_key, chunk_index)
);

create table if not exists public.roberta_catalog_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.roberta_knowledge_sources(source_key) on delete cascade,
  categoria text not null,
  nome text not null,
  descrizione text not null,
  prezzo numeric,
  potenza_kw numeric,
  accumulo_kwh numeric,
  metadata jsonb not null default '{}'::jsonb,
  aggiornato_at timestamptz not null default now()
);

create index if not exists roberta_chunks_categoria_idx
  on public.roberta_knowledge_chunks (categoria);

create index if not exists roberta_chunks_keywords_idx
  on public.roberta_knowledge_chunks using gin (keywords);

create index if not exists roberta_catalog_categoria_idx
  on public.roberta_catalog_items (categoria);

create index if not exists roberta_catalog_prezzo_idx
  on public.roberta_catalog_items (prezzo);

alter table public.roberta_knowledge_sources enable row level security;
alter table public.roberta_knowledge_chunks enable row level security;
alter table public.roberta_catalog_items enable row level security;

-- Nessuna policy: accesso solo server-side service-role. Il sito legge tramite
-- /api/public/roberta-knowledge con Bearer LISTINO_READ_KEY.

commit;
