-- Metadati sync Zoho per il modulo Compiti.
-- Colonne tecniche per dry-run/write-mode futuro: nessuna funzionalita' CRM
-- operativa deve dipendere da questi campi.

alter table public.compiti
  add column if not exists zoho_modified_at timestamp with time zone,
  add column if not exists zoho_synced_at timestamp with time zone;

comment on column public.compiti.zoho_modified_at is
  'Orario del registro delle modifiche importato da Zoho Compiti.';

comment on column public.compiti.zoho_synced_at is
  'Timestamp tecnico dell ultimo write-mode Zoho -> CRM per il record compito.';
