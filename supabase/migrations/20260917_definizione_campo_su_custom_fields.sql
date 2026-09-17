-- Sposta la DEFINIZIONE di un campo su crm_custom_fields.
--
-- Fino a oggi `formula`, `sola_lettura` e `formato` vivevano su
-- crm_layout_campi, cioe' sul PIAZZAMENTO del campo dentro un blocco. Era
-- coerente finche' il layout era l'unico posto in cui si configurava qualcosa,
-- ma confonde due domande diverse:
--
--   "dove sta questo campo"  -> layout   (pagina, blocco, ordine, span)
--   "cosa e' questo campo"   -> attributi (tipo, valori, formula, formato)
--
-- Una formula non cambia se sposto il campo da un blocco all'altro, e deve
-- esistere anche per un campo non ancora piazzato in nessuna scheda. Quindi
-- appartiene al campo, non alla sua posizione.
--
-- In pratica il vincolo applicativo "un campo compare una volta sola per
-- modulo" (verificato in app/api/crm-settings/layout/route.ts) rendeva gia'
-- queste colonne per-campo di fatto: qui la cosa diventa esplicita.
--
-- DELIBERATAMENTE NON DISTRUTTIVA. Le tre colonne restano anche su
-- crm_layout_campi finche' il render non legge dalla nuova posizione. Il
-- travaso dei dati non e' qui ma in scripts/migrations/sposta-definizione-campi.mjs,
-- perche' la corrispondenza fra la chiave del layout ("Importo Contrattuale")
-- e il nome della colonna (importo_contrattuale) e' descritta in TypeScript
-- (lib/clienti/zoho-fields.ts, lib/leads/field-map.ts) e non e' nota a Postgres.
-- Il drop delle vecchie colonne arrivera' in una migrazione successiva, a
-- travaso verificato: cosi' un rollback non perde le formule.

begin;

alter table public.crm_custom_fields
  -- Campo calcolato: espressione nel dialetto tradotto dalle formule Zoho.
  -- Quando e' valorizzata il campo non e' scrivibile e il valore si ricalcola
  -- a ogni lettura. Qui si conserva solo la definizione, la valutazione resta
  -- dell'applicazione (lib/crm-settings/formula-eval.ts).
  add column if not exists formula jsonb,

  -- Congela un campo che sarebbe scrivibile. I campi con formula sono gia'
  -- di sola lettura per natura: questo copre il caso diverso di un campo
  -- normale che l'admin non vuole far toccare.
  add column if not exists sola_lettura boolean not null default false,

  -- Formattazione di presentazione (decimali, valuta, placeholder).
  -- Non altera mai il valore salvato.
  add column if not exists formato jsonb not null default '{}'::jsonb;

-- Una formula vuota e' un errore silenzioso: il campo smette di essere
-- calcolato senza che nessuno se ne accorga. Meglio rifiutare la riga.
alter table public.crm_custom_fields
  drop constraint if exists crm_custom_fields_formula_non_vuota;

alter table public.crm_custom_fields
  add constraint crm_custom_fields_formula_non_vuota check (
    formula is null
    or (
      jsonb_typeof(formula) = 'object'
      and coalesce(btrim(formula ->> 'expr'), '') <> ''
    )
  );

-- Stesso ragionamento per il formato: un jsonb che non e' un oggetto qui
-- significa che qualcuno ha scritto una forma che leggiFormato() scartera'
-- in silenzio, mostrando numeri non formattati senza spiegazione.
alter table public.crm_custom_fields
  drop constraint if exists crm_custom_fields_formato_oggetto;

alter table public.crm_custom_fields
  add constraint crm_custom_fields_formato_oggetto check (
    jsonb_typeof(formato) = 'object'
  );

commit;
