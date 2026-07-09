-- Tracciamento Zoho, telefono, tag libero e collegamento futuro per
-- Installatori. La tabella installatori esisteva senza queste colonne
-- (verificato via introspezione schema Supabase: nessuna migration
-- precedente le definiva). zoho_id serve per l'idempotenza di
-- scripts/migrations/import-zoho-installatori.mjs. telefono mappa
-- direttamente la colonna "Telefono" dell'export Zoho (mancava del tutto).
-- tag è testo libero e filtrabile (vedi colonna "Tag" dell'export Zoho:
-- nessun significato di stato, es. "SICILIA", "Inattivo", "TOSCANA" — mai
-- interpretarlo). connesso_a_id/connesso_a_tipo rispecchiano le colonne
-- già presenti su scadenze, per quando l'export Zoho popolerà "Connected
-- To.module" / "Connesso a.id" (oggi sempre vuote su tutte le righe).
alter table public.installatori
  add column if not exists zoho_id text,
  add column if not exists telefono text,
  add column if not exists tag text,
  add column if not exists connesso_a_id uuid,
  add column if not exists connesso_a_tipo text;

-- Indice pieno (non parziale): un indice unique parziale non è utilizzabile
-- per l'inferenza ON CONFLICT di supabase-js .upsert(); i NULL restano
-- comunque ammessi più volte in un indice unique standard.
create unique index if not exists installatori_zoho_id_uidx
  on public.installatori (zoho_id);
