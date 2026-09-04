-- MANUAL, after approval. Not part of automatic schema migrations.
-- First inspect the preview query below. The transaction only links unique,
-- exact case-insensitive trimmed names, never overwrites an existing owner.
-- This affects access scopes: review the proposed assignments before COMMIT.
begin;
lock table public.clienti in share row exclusive mode;
lock table public.utenti in share mode;

create table if not exists public.report_vito_owner_backfill_audit (
  cliente_id uuid primary key,
  owner_name text not null,
  assigned_owner_id uuid not null,
  applied_at timestamptz not null default now()
);
alter table public.report_vito_owner_backfill_audit enable row level security;
revoke all on public.report_vito_owner_backfill_audit from public, anon, authenticated;

create temporary table report_owner_candidates on commit drop as
select c.id, c.clienti_proprietario as owner_name, (array_agg(u.id))[1] as owner_id
from public.clienti c
join public.utenti u on lower(btrim(u.nome)) = lower(btrim(c.clienti_proprietario))
where c.clienti_proprietario_id is null
  and nullif(btrim(c.clienti_proprietario), '') is not null
  and not exists (select 1 from public.report_vito_owner_backfill_audit a where a.cliente_id = c.id)
group by c.id, c.clienti_proprietario
having count(*) = 1;

select owner_name, owner_id, count(*) as clienti_da_associare
from report_owner_candidates group by owner_name, owner_id order by owner_name;

select count(*) as clienti_senza_corrispondenza_univoca
from public.clienti c
where c.clienti_proprietario_id is null
  and not exists (select 1 from report_owner_candidates p where p.id = c.id)
  and not exists (select 1 from public.report_vito_owner_backfill_audit a where a.cliente_id = c.id);

insert into public.report_vito_owner_backfill_audit (cliente_id, owner_name, assigned_owner_id)
select id, owner_name, owner_id from report_owner_candidates;

update public.clienti c set clienti_proprietario_id = p.owner_id
from report_owner_candidates p where c.id = p.id and c.clienti_proprietario_id is null;

-- Default is a dry run: data AND audit changes are rolled back.
-- Replace ROLLBACK with COMMIT only after reviewing and authorizing the preview.
rollback;
