-- Ordine personale dei campi dentro un blocco.
--
-- Completa le due preferenze gia' presenti (ordine delle pagine e dei
-- blocchi): un utente puo' spostare anche i singoli campi dentro un riquadro,
-- e la disposizione resta sua.
--
--   { "informazioni-tecniche-ftv": ["Nr. Moduli", "COD- MODULI", ...], ... }
--
-- La chiave e' il block_key, il valore l'elenco dei field_key nell'ordine
-- voluto. I campi non elencati seguono in coda nell'ordine dell'admin, cosi'
-- un campo aggiunto dopo compare comunque invece di sparire.

begin;

alter table public.crm_layout_ordine_utente
  add column if not exists ordine_campi jsonb not null default '{}'::jsonb;

commit;
