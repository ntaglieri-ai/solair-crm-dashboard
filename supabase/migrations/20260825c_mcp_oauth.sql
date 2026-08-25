-- OAuth 2.1 per il server MCP: da bearer statico condiviso a identita' per
-- utente.
--
-- Fino a qui /api/mcp accettava un solo token (MCP_ACCESS_TOKEN) e impersonava
-- sempre lo stesso utente (VITO_USER_ID). Con queste tabelle il connettore
-- diventa multi-utente: ognuno si autentica col proprio account CRM e riceve
-- un access token che dice chi e'.
--
-- Le tre tabelle sono un registro di autenticazione, non dato business:
-- RLS attiva e ZERO policy, come mcp_tool_log. Da PostgREST non esistono per
-- nessun ruolo; ci scrive e ci legge solo il service_role, dentro
-- lib/mcp/oauth/*.
--
-- Nessuna foreign key verso `utenti`, deliberatamente: queste righe sono un
-- registro di credenziali con vita propria (un refresh token revocato deve
-- restare visibile anche dopo), e il controllo che conta — utente esistente,
-- attivo, con ruolo ammesso — viene rifatto a OGNI richiesta in
-- lib/mcp/oauth/identita.ts, non delegato all'integrita' referenziale.

-- ---------------------------------------------------------------------------
-- Client registrati dinamicamente (RFC 7591).
--
-- Claude non ha un client_id preconcordato: lo chiede a /register al momento
-- di collegare il connettore. Qui si registra cosa ha chiesto, cosi' il
-- redirect_uri presentato a /authorize si puo' confrontare con quello del
-- client e non solo con la whitelist globale.
create table if not exists public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text,
  redirect_uris text[] not null,
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now(),
  ultimo_uso_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Authorization code: monouso, TTL 60 secondi.
--
-- Sta su tabella e non in memoria perche' /authorize e /token sono due
-- invocazioni serverless distinte, che su Vercel cadono su istanze diverse:
-- un codice tenuto in RAM non sarebbe ritrovabile al momento dello scambio.
--
-- Si salva l'hash, non il codice: chi legge la tabella non puo' spenderlo.
create table if not exists public.mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  resource text,
  scope text,
  utente_id uuid not null,
  auth_user_id uuid not null,
  ruolo text not null,
  created_at timestamptz not null default now(),
  scade_at timestamptz not null,
  usato_at timestamptz
);

create index if not exists mcp_oauth_codes_scade_at_idx
  on public.mcp_oauth_codes (scade_at);

-- ---------------------------------------------------------------------------
-- Refresh token: 30 giorni, ruotato a ogni uso, revocabile per singolo utente.
--
-- `revoked_at` e' la leva che permette di staccare una persona senza aspettare
-- la scadenza naturale; `sostituito_da` tiene la catena delle rotazioni, cosi'
-- un token vecchio ripresentato si riconosce come tale.
create table if not exists public.mcp_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  client_id text not null,
  utente_id uuid not null,
  auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  scade_at timestamptz not null,
  ultimo_uso_at timestamptz,
  revoked_at timestamptz,
  sostituito_da uuid
);

create index if not exists mcp_refresh_tokens_utente_idx
  on public.mcp_refresh_tokens (utente_id, created_at desc);

create index if not exists mcp_refresh_tokens_scade_at_idx
  on public.mcp_refresh_tokens (scade_at);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_refresh_tokens enable row level security;

-- Nessuna policy, deliberatamente: solo service_role scrive e legge.
revoke all on public.mcp_oauth_clients from anon, authenticated;
revoke all on public.mcp_oauth_codes from anon, authenticated;
revoke all on public.mcp_refresh_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chi ha chiamato il tool.
--
-- Le righe gia' scritte restano a NULL e vanno lette come "Vito": fino al
-- 25/08/2026 il server MCP aveva un utente solo. Non si migrano: inventare un
-- id a posteriori renderebbe il registro meno affidabile, non piu'.
alter table public.mcp_tool_log
  add column if not exists utente_id uuid;

create index if not exists mcp_tool_log_utente_idx
  on public.mcp_tool_log (utente_id, created_at desc);
