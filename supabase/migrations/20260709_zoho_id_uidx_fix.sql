-- Fix indici unique su zoho_id per scadenze/installatori.
-- Gli indici parziali (where zoho_id is not null) creati in
-- 20260709_scadenze_zoho_import.sql / 20260709_installatori_zoho_import.sql
-- non sono utilizzabili da Postgres per l'inferenza ON CONFLICT di un
-- upsert senza ripetere lo stesso WHERE nella query (non supportato da
-- supabase-js .upsert(..., {onConflict}), che genera "ON CONFLICT (col)"
-- senza predicato) — verificato in errore runtime durante
-- scripts/migrations/import-zoho-scadenze.mjs: "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification".
-- Un indice unique pieno (senza WHERE) è equivalente in pratica: Postgres
-- tratta ogni NULL come distinto ai fini dell'unicità, quindi più record
-- creati da UI con zoho_id NULL restano ammessi.
drop index if exists public.scadenze_zoho_id_uidx;
create unique index scadenze_zoho_id_uidx on public.scadenze (zoho_id);

drop index if exists public.installatori_zoho_id_uidx;
create unique index installatori_zoho_id_uidx on public.installatori (zoho_id);
