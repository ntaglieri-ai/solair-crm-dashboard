-- Registro delle chiamate del server MCP.
--
-- Perche' una tabella nuova invece di audit_log: audit_log e' fuori dal
-- perimetro del modulo MCP e ci resta. Questo registro e' separato, sta fuori
-- dal CRM come dato di prodotto ed e' leggibile solo in service_role — la
-- tabella ha RLS attiva e ZERO policy, quindi da PostgREST non esiste, per
-- nessun ruolo, esattamente come stavano le offerta_commerciale_* prima della
-- 20260824f.
--
-- Conseguenza da ricordare: una cancellazione fatta via MCP compare qui e NON
-- in audit_log. I due registri vanno letti insieme.
--
-- Gli argomenti sono salvati ridotti dal codice (lib/mcp/log.ts): id e
-- parametri di query si', IBAN / email / telefono / credenziali no.

create table if not exists public.mcp_tool_log (
  id uuid primary key default gen_random_uuid(),
  tool text not null,
  argomenti jsonb not null default '{}'::jsonb,
  esito text not null check (esito in ('ok', 'errore', 'negato')),
  errore text,
  righe integer,
  durata_ms integer,
  created_at timestamptz not null default now()
);

alter table public.mcp_tool_log enable row level security;

-- Nessuna policy, deliberatamente: solo service_role scrive e legge.

create index if not exists mcp_tool_log_created_at_idx
  on public.mcp_tool_log (created_at desc);

create index if not exists mcp_tool_log_tool_idx
  on public.mcp_tool_log (tool, created_at desc);

-- I default privilege di Supabase concedono le grant a anon/authenticated:
-- la RLS li fermerebbe comunque, ma meglio non dipendere da un solo strato.
revoke all on public.mcp_tool_log from anon, authenticated;
