-- Team operativi indipendenti dalle sedi. Nessun utente viene assegnato
-- automaticamente: Vito potra' comporre team, agenti e direttori dalla UI.

begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descrizione text,
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_nome_non_vuoto check (length(trim(nome)) > 0)
);

create unique index if not exists teams_nome_unique_ci
  on public.teams (lower(trim(nome)));

create table if not exists public.team_agenti (
  team_id uuid not null references public.teams(id) on delete cascade,
  utente_id uuid not null references public.utenti(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, utente_id),
  -- Prima versione: ogni agente ha al massimo un team principale.
  unique (utente_id)
);

create table if not exists public.team_direttori (
  team_id uuid not null references public.teams(id) on delete cascade,
  utente_id uuid not null references public.utenti(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, utente_id)
);

create index if not exists team_agenti_team_idx on public.team_agenti(team_id);
create index if not exists team_direttori_utente_idx on public.team_direttori(utente_id);

alter table public.teams enable row level security;
alter table public.team_agenti enable row level security;
alter table public.team_direttori enable row level security;

-- La risoluzione dello scope team avviene lato server con la sessione
-- autenticata, quindi tutti gli utenti devono poter leggere la struttura.
create policy teams_read on public.teams for select to authenticated using (true);
create policy team_agenti_read on public.team_agenti for select to authenticated using (true);
create policy team_direttori_read on public.team_direttori for select to authenticated using (true);

-- La gestione usa lo stesso permesso gia' impiegato per utenti e ruoli.
create policy teams_manage on public.teams for all to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));
create policy team_agenti_manage on public.team_agenti for all to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));
create policy team_direttori_manage on public.team_direttori for all to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

commit;
