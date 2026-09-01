create extension if not exists pg_trgm with schema extensions;

create index if not exists leads_updated_at_created_at_idx
  on public.leads (updated_at desc nulls last, created_at desc nulls last);

create index if not exists leads_owner_updated_at_idx
  on public.leads (lead_proprietario_id, updated_at desc nulls last)
  where lead_proprietario_id is not null;

create index if not exists leads_nome_lead_trgm_idx
  on public.leads using gin (nome_lead gin_trgm_ops);

create index if not exists leads_email_trgm_idx
  on public.leads using gin (email gin_trgm_ops);

create index if not exists leads_telefono_trgm_idx
  on public.leads using gin (telefono gin_trgm_ops);

create index if not exists clienti_updated_at_created_at_idx
  on public.clienti (updated_at desc nulls last, created_at desc nulls last);

create index if not exists clienti_owner_updated_at_idx
  on public.clienti (clienti_proprietario_id, updated_at desc nulls last)
  where clienti_proprietario_id is not null;

create index if not exists clienti_installatore_nome_idx
  on public.clienti (installatore);

create index if not exists clienti_nome_clienti_trgm_idx
  on public.clienti using gin (nome_clienti gin_trgm_ops);

create index if not exists clienti_email_trgm_idx
  on public.clienti using gin (email gin_trgm_ops);

create index if not exists clienti_cellulare_trgm_idx
  on public.clienti using gin (cellulare gin_trgm_ops);

analyze public.leads;
analyze public.clienti;
analyze public.lead_tags;
analyze public.cliente_tags;
