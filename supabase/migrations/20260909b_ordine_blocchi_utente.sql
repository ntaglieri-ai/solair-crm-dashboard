-- Ordine personale dei blocchi dentro una pagina.
--
-- crm_layout_ordine_utente teneva finora solo l'ordine delle PAGINE. Serve
-- anche quello dei BLOCCHI: un utente puo' spostare i riquadri dentro la
-- scheda mentre lavora, e la disposizione resta sua senza cambiare quella
-- degli altri.
--
-- Colonna separata invece di riusare `ordine`: quella e' un array di
-- page_key, questa e' una mappa pagina -> elenco di blocchi. Mescolarle
-- avrebbe richiesto di riscrivere le preferenze gia' salvate.
--
--   { "impianto": ["informazioni-tecniche-ftv", "zavorre"], ... }
--
-- I blocchi non elencati seguono in coda nell'ordine dell'admin, cosi' un
-- blocco aggiunto dopo compare comunque invece di sparire.

begin;

alter table public.crm_layout_ordine_utente
  add column if not exists ordine_blocchi jsonb not null default '{}'::jsonb;

commit;
