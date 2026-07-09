-- Tag libero per Scadenze, per parità con Installatori (colonna "tag" già
-- presente lì, vedi 20260709_installatori_zoho_import.sql). La tabella
-- scadenze non ha mai avuto un campo Tag (l'export Zoho di Scadenze non lo
-- includeva): questa colonna nasce vuota e viene popolata solo da editing
-- manuale in-app, non da import.
alter table public.scadenze
  add column if not exists tag text;
