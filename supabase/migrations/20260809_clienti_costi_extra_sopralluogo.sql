-- Costi extra emersi dal sopralluogo (procedura Vito, Fase 4 punto 4.1).
--
-- Perche' una colonna nuova invece di riusare clienti.importi_extra: quella e'
-- `text` ereditata dall'export Zoho (20260707_clienti_zoho_schema.sql, voce
-- 'importi_extra') e contiene annotazioni libere storiche, non un numero.
-- Resta intatta come archivio in sola lettura: qui serve un importo che il CRM
-- possa sommare all'importo contrattuale, non una stringa da interpretare a
-- runtime.
--
-- Niente `not null` e niente default 0: null = "non ancora rilevato" e' diverso
-- da 0 = "sopralluogo fatto, nessun costo extra". Un default 0 dichiarerebbe
-- ogni cliente gia' esistente come "verificato senza extra" senza che nessuno
-- lo abbia deciso, e il totale mostrato in scheda sarebbe una conferma falsa.
--
-- numeric senza precisione fissa, come le altre voci economiche della tabella
-- (importo_contrattuale, importo_da_listino, importo_tica).

begin;

alter table public.clienti
  add column if not exists costi_extra_sopralluogo numeric default null;

comment on column public.clienti.costi_extra_sopralluogo is
  'Costi extra rilevati in sopralluogo (Fase 4.1), in euro. Si somma a importo_contrattuale per il totale aggiornato. null = non ancora rilevato, distinto da 0. Campo CRM, non correlato al testo storico Zoho clienti.importi_extra.';

commit;

-- Verifica rapida dopo l'esecuzione:
-- select
--   count(*) filter (where costi_extra_sopralluogo is null)  as da_rilevare,
--   count(*) filter (where costi_extra_sopralluogo = 0)      as senza_extra,
--   count(*) filter (where costi_extra_sopralluogo > 0)      as con_extra,
--   coalesce(sum(costi_extra_sopralluogo), 0)                as totale_extra
-- from public.clienti;
