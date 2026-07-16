-- Nextcloud folder-path permissions, DB-backed and dynamically editable.
--
-- Sostituisce l'array hardcoded RULES in lib/nextcloud/path-permissions.ts con
-- una tabella per-(prefisso, ruolo). Ogni riga dice qual e' l'accesso di un
-- ruolo a tutti i path che iniziano con `path_prefix`. La `priorita` piu' bassa
-- vince per prima, preservando la semantica "most specific wins" dell'ordine
-- dell'array originale. Se nessun prefisso matcha, il default resta "visibile a
-- tutti" (i prefissi ristretti sono enumerati esplicitamente).
--
-- I valori di `accesso` sono gli stessi supportati da permessi_campo:
-- hidden | readonly | editable. Per l'enforcement dei path, hidden = nessun
-- accesso; readonly/editable = accesso (la cartella e' visibile/navigabile).

create table if not exists public.permessi_cartelle_nextcloud (
  id uuid primary key default gen_random_uuid(),
  -- Prefisso relativo alla root "files" dell'utente, senza slash iniziale,
  -- match "starts with" case-sensitive per rispettare il casing reale.
  path_prefix text not null,
  ruolo_id uuid not null references public.ruoli(id) on delete cascade,
  accesso text not null default 'hidden',
  priorita integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permessi_cartelle_nextcloud_accesso_check
    check (accesso in ('hidden', 'readonly', 'editable')),
  unique (path_prefix, ruolo_id)
);

create index if not exists permessi_cartelle_nextcloud_priorita_idx
  on public.permessi_cartelle_nextcloud (priorita, path_prefix);

-- RLS: lettura consentita a tutti gli autenticati (le regole path servono a
-- ENFORCE l'accesso, quindi ogni sessione deve poterle leggere); scrittura
-- riservata a SUPERADMIN/ADMIN. La verifica del ruolo passa da una funzione
-- SECURITY DEFINER per evitare dipendenze/ricorsioni con la RLS di utenti.
alter table public.permessi_cartelle_nextcloud enable row level security;

create or replace function public.nc_path_perms_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.utenti u
    left join public.ruoli r on r.id = u.ruolo_id
    where (
        u.auth_user_id = auth.uid()
        or lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and upper(coalesce(r.code, r.nome, u.ruolo)) in ('SUPERADMIN', 'ADMIN')
  );
$$;

grant execute on function public.nc_path_perms_can_write() to authenticated;

drop policy if exists permessi_cartelle_nextcloud_read on public.permessi_cartelle_nextcloud;
create policy permessi_cartelle_nextcloud_read
  on public.permessi_cartelle_nextcloud
  for select
  to authenticated
  using (true);

drop policy if exists permessi_cartelle_nextcloud_admin_write on public.permessi_cartelle_nextcloud;
create policy permessi_cartelle_nextcloud_admin_write
  on public.permessi_cartelle_nextcloud
  for all
  to authenticated
  using (public.nc_path_perms_can_write())
  with check (public.nc_path_perms_can_write());

-- ---------------------------------------------------------------------------
-- Seed 1:1 dell'array hardcoded corrente (lib/nextcloud/path-permissions.ts).
-- Comportamento IDENTICO a oggi subito dopo la migration: nessun cambiamento
-- finche' qualcuno non modifica una regola dalla nuova UI.
--
-- Traduzione: per ogni prefisso, i ruoli oggi "allowed" -> 'editable', gli altri
-- -> 'hidden'. I prefissi "roles: null" (visibili a tutti) -> 'editable' per
-- tutti i ruoli. Categoria 6 "Operativo generale" NON e' seedata: resta il
-- default implicito "visibile a tutti" (nessun prefisso matcha), byte-identico
-- al comportamento odierno.
with seed(path_prefix, priorita, superadmin, admin, director, standard, agent) as (
  values
    -- Cat 1 — Dati cliente sensibili (oggi: solo Director+; STANDARD/AGENT bloccati)
    ('Vendita-Digitale/Clienti 2.0/',        10, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    ('My-Space/Apps/Zoho CRM/Clienti/',       20, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    -- Cat 2 — Finanziaria / Contratti / Preventivi / Finanziamenti (Director+)
    ('Vendita-Digitale/Finanziaria/',         30, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    ('Solair-Agenti/Finanziaria',             40, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    ('Solair-Agenti/FINANZIAMENTI',           50, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    -- Cat 3 — Firme e Timbri (solo Admin+)
    ('Solair-Ufficio/VIOLA/Firme E Timbri/',  60, 'editable', 'editable', 'hidden',   'hidden', 'hidden'),
    -- Cat 5 — Archivio storico "Old" (Director+)
    ('Solair-Ufficio/Old',                    70, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    ('Vendita-Digitale/Old',                  80, 'editable', 'editable', 'editable', 'hidden', 'hidden'),
    -- Cat 4 — Materiale commerciale (tutti i ruoli)
    ('LISTINI',                               90, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Schede tecniche',                      100, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('INSERZIONI ATTIVE',                    110, 'editable', 'editable', 'editable', 'editable', 'editable'),
    ('Sponsorizzate',                        120, 'editable', 'editable', 'editable', 'editable', 'editable')
),
resolved as (
  select
    s.path_prefix,
    s.priorita,
    r.id as ruolo_id,
    case upper(coalesce(r.code, r.nome))
      when 'SUPERADMIN' then s.superadmin
      when 'ADMIN' then s.admin
      when 'DIRECTOR' then s.director
      when 'STANDARD' then s.standard
      when 'AGENT' then s.agent
      else null
    end as accesso
  from seed s
  cross join public.ruoli r
  where upper(coalesce(r.code, r.nome)) in ('SUPERADMIN', 'ADMIN', 'DIRECTOR', 'STANDARD', 'AGENT')
)
insert into public.permessi_cartelle_nextcloud (path_prefix, ruolo_id, accesso, priorita)
select path_prefix, ruolo_id, accesso, priorita
from resolved
where accesso is not null
on conflict (path_prefix, ruolo_id) do update set
  accesso = excluded.accesso,
  priorita = excluded.priorita,
  updated_at = now();
