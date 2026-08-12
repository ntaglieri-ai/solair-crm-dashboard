-- Codici sconto: flag di cumulabilita' con lo sconto di zona.
--
-- I codici sconto vivono dentro il jsonb `codici_sconto` di
-- offerta_commerciale_cataloghi, quindi non c'e' una colonna da aggiungere:
-- si aggiunge una chiave agli oggetti gia' presenti e si allinea il default
-- lato applicazione (normalizeCodiciSconto in lib/offerta-commerciale/store.ts,
-- che tratta l'assenza della chiave come false).
--
-- Semantica del campo, implementata in lib/offerta-commerciale/calcola-preventivo.ts:
--   true  -> la percentuale del codice si SOMMA allo sconto di zona
--   false -> la percentuale del codice SOSTITUISCE lo sconto di zona
--
-- Default false: e' l'ipotesi prudente (nessuno sconto extra inatteso sui
-- codici gia' in archivio, creati quando il calcolo non li usava affatto).
--
-- Idempotente: si tocca solo cio' che non ha ancora la chiave, quindi la si
-- puo' rieseguire senza effetti.

begin;

update public.offerta_commerciale_cataloghi
   set codici_sconto = (
         select jsonb_agg(
                  case
                    when jsonb_typeof(elemento) = 'object'
                     and not (elemento ? 'cumulabile_con_sconto_zona')
                    then elemento || '{"cumulabile_con_sconto_zona": false}'::jsonb
                    else elemento
                  end
                  order by posizione
                )
           from jsonb_array_elements(codici_sconto)
                with ordinality as voci(elemento, posizione)
       ),
       aggiornato_at = now()
 where jsonb_typeof(codici_sconto) = 'array'
   and exists (
         select 1
           from jsonb_array_elements(codici_sconto) as voci(elemento)
          where jsonb_typeof(elemento) = 'object'
            and not (elemento ? 'cumulabile_con_sconto_zona')
       );

comment on column public.offerta_commerciale_cataloghi.codici_sconto is
  'Codici sconto configurabili per il catalogo commerciale. Ogni voce: '
  '{codice, nome, descrizione, tipo (percentuale|importo|omaggio|nota), valore, attivo, '
  'cumulabile_con_sconto_zona}. Con cumulabile_con_sconto_zona=true la percentuale del '
  'codice si somma allo sconto di zona, con false lo sostituisce.';

commit;

-- Verifica rapida dopo l'esecuzione:
-- select nome, stato,
--        jsonb_pretty(codici_sconto) as codici
--   from offerta_commerciale_cataloghi
--  where jsonb_array_length(codici_sconto) > 0;
