-- Tracciamento Zoho per Scadenze.
-- La tabella scadenze esisteva senza colonne per l'id Zoho o per un nome
-- proprietario di fallback (verificato via introspezione schema Supabase:
-- nessuna migration precedente la definiva). Necessario per l'idempotenza
-- di scripts/migrations/import-zoho-scadenze.mjs e per mostrare un nome
-- proprietario anche se lo zoho_id non risolve a un utente in `utenti`.
alter table public.scadenze
  add column if not exists zoho_id text,
  add column if not exists proprietario_nome text;

-- Indice pieno (non parziale): un indice unique parziale non è utilizzabile
-- per l'inferenza ON CONFLICT di supabase-js .upsert(); i NULL restano
-- comunque ammessi più volte in un indice unique standard.
create unique index if not exists scadenze_zoho_id_uidx
  on public.scadenze (zoho_id);
