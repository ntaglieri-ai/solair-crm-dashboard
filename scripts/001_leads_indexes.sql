-- Indici per ottimizzare le query della pagina /leads.
-- Eseguire questo script sul database Supabase (SQL Editor o migrazione).
--
-- - created_at: usato per l'ordinamento di default (ORDER BY created_at DESC)
--   e per la paginazione con .range().
-- - stato_lead: filtro per stato lead.
-- - lead_proprietario_id: filtro per commerciale assegnato (assigned_to).

-- Ordinamento cronologico discendente sulla prima pagina e paginazione.
create index if not exists idx_leads_created_at
  on public.leads (created_at desc);

-- Filtro per stato lead (status).
create index if not exists idx_leads_stato_lead
  on public.leads (stato_lead);

-- Filtro per commerciale assegnato (assigned_to).
create index if not exists idx_leads_lead_proprietario_id
  on public.leads (lead_proprietario_id);

-- Indice composito per i casi comuni: filtro per stato + ordine cronologico.
create index if not exists idx_leads_stato_created_at
  on public.leads (stato_lead, created_at desc);
