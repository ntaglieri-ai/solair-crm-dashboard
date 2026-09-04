# Report Vito — interventi sui punti arancioni

Branch di lavoro: `codex/report-vito-parziali`, base `280899b` (main/develop verificati su origin). Consegna richiesta: un unico commit della run su `origin/develop`.

Il collaudo descritto è locale. La pubblicazione Git su `develop` non applica le migrazioni: nessun aggiornamento dei dati di produzione è stato eseguito.
I colori sotto distinguono l'implementazione dal rilascio: non certificano modifiche già online.

## Punti lavorati

| Cap. | Punto | Esito locale | Passaggio ancora necessario |
|---|---|---|---|
| 1 | Nomi clienti leggibili | Corretto e verificato nel browser, anche con colonna stretta e parole senza spazi. | Rilascio. |
| 2 | Salvataggio campi | Test di persistenza, errori, permessi, date e valori custom superati. Verifica UI con server isolato. Corretto il falso successo nella creazione. | Collaudo integrato dopo rilascio. |
| 4 | Filtro proprietario | Preparati backfill controllato, anteprima, audit e rollback; test PostgreSQL superati. | Approvare e applicare il backfill sui dati reali. |
| 4 | Ordinamento data modifica | Query e visualizzazione coerenti, fallback sulle date native, spareggio per ID prima della paginazione. | Applicare migrazione `20260904b`, poi rilasciare. |
| 4 | Ordinamento proprietario | Ordinamento globale per nome visualizzato, con fallback storico e permessi RLS. | Applicare migrazione `20260904b`, poi rilasciare. |
| 6 | Installatore a tendina | Fonte reale, UUID e nome canonico risolto dal server; visualizzazione valori storici conservata. Creazione e modifica verificate nel browser. | Rilascio. |
| 6 | Valori campi personalizzati | Compilazione nel modulo; validazione server di tipi, obbligatorietà e permessi; esclusione colonne arbitrarie. | Rilascio. Nessun nuovo campo reale creato per provare. |
| 9 | Obbligo tre documenti | Rimossi testi residui; conversione senza gate verificata nei test della route. | Rilascio. |
| 9 | Doppie conversioni Lead | RPC atomica, blocco sul Lead, indice univoco, recupero cliente già collegato da conversione interrotta. Test su retry, rollback e scope. | Applicare migrazione `20260904c`, poi rilasciare. Nessuna fusione di schede eseguita. |
| 10 | Data sopralluogo | Modifica e cancellazione provate; data-only invariata, errori espliciti per date impossibili. | Rilascio e collaudo integrato. |
| 11 | Email automatiche esistenti | Benvenuto, reset e menzioni verificati con test e SMTP locale reale; nessun messaggio esterno. | Verificare consegna in produzione con destinatario di test autorizzato. |
| 12 | Filtro proprietario | Preparati backfill controllato, anteprima, audit e rollback; test PostgreSQL superati. | Approvare e applicare il backfill sui dati reali. |

## Verifiche eseguite

- Suite Vitest: 199 test superati in 25 file (include un server SMTP locale, senza rete esterna).
- Controllo TypeScript: superato.
- Build Next.js: superata; avviso preesistente sulla convenzione middleware.
- ESLint mirato sui file applicativi modificati: superato.
- PostgreSQL isolato (PGlite): 19 verifiche superate. Schema ridotto con i tipi rilevanti, confrontati in lettura con OpenAPI di Supabase. Non è una copia completa di tutte le policy/constraint del database reale e non prova concorrenza multi-connessione in produzione.
- Browser: componenti reali e CSS del progetto con API di prova in memoria. Provati modifica, svuotamento date, rilettura dopo reload, selezione installatore/proprietario, successo ed errore della creazione, conservazione bozza e nome lungo. Nessun errore console osservato.
- Lettura Supabase del 04/09: 721 clienti, 720 proprietari storici senza UUID; 720 corrispondenze univoche, zero ambigue e zero mancanti. Nessun `lead_id` duplicato rilevato; non dimostra assenza di doppie schede prive di collegamento.

## Ordine di rilascio — non eseguito

1. Ricontrollare branch e modifiche remote prima del merge.
2. Applicare `supabase/migrations/20260904b_clienti_report_sort.sql`: vista in sola lettura con `security_invoker`, nessuna modifica ai clienti.
3. Applicare `supabase/migrations/20260904c_atomic_lead_conversion.sql`: indice univoco e RPC riservata al backend. Si interrompe senza rimuovere dati se trova duplicati collegati allo stesso Lead.
4. Eseguire l'anteprima di `scripts/migrations/report-vito-owner-backfill.sql`. Di default termina con ROLLBACK. Dopo approvazione delle associazioni, sostituire soltanto il ROLLBACK finale con COMMIT. L'assegnazione cambia anche il perimetro di visibilità dei clienti: non applicare senza approvazione.
5. Rilasciare il codice solo dopo le migrazioni di schema. Non esiste un ripiego alla vecchia conversione non atomica.
6. Collaudare il flusso integrato con un record e un destinatario autorizzati.

Ripristino associazioni: `scripts/migrations/report-vito-owner-rollback.sql`, anch'esso dry-run per default. Ripristina solo l'UUID dei record ancora corrispondenti all'assegnazione registrata, conserva l'audit e non sovrascrive assegnazioni successive differenti.

## Riepilogo completo del report

Legenda: verde = implementato; giallo = completabile con quanto disponibile, incluso rilascio/collaudo ancora necessario; rosso = mancano decisioni esterne; blu = nuova funzionalità interamente da costruire.

| Cap. | Punto | Stato |
|---|---|---|
| 1 | Nomi leggibili | 🟨 Corretto localmente; da rilasciare. |
| 1 | Riordino scheda | 🟩 Già implementato, non modificato. |
| 2 | Tre pallini colonne | 🟩 Già implementato, non modificato. |
| 2 | Salvataggi | 🟨 Correzioni e test locali completati; da rilasciare e verificare integrati. |
| 2 | Modifica in-line | 🟦 Non implementata, fuori da questo intervento. |
| 3 | Gestione TAG | 🟩 Già implementata, non modificata. |
| 3 | Filtro TAG | 🟩 Già implementato, non modificato. |
| 4 | Combinazione filtri presenti | 🟩 Già verificata, non modificata. |
| 4 | Filtro proprietario | 🟨 Backfill preparato e testato; da approvare e applicare. |
| 4 | Ordinamento data modifica | 🟨 Corretto localmente; migrazione e rilascio necessari. |
| 4 | Ordinamento data creazione | 🟩 Già presente; fallback reso coerente nella nuova vista. |
| 4 | Ordinamento stato | 🟩 Già implementato. |
| 4 | Ordinamento proprietario | 🟨 Corretto localmente; migrazione e rilascio necessari. |
| 4 | Ordinamento installatore | 🟩 Già implementato. |
| 4 | Ordinamento zona | 🟩 Già implementato; zona inclusa nella proiezione lista. |
| 4 | Filtri avanzati AND/OR Zoho | 🟦 Non implementati; serve esempio desiderato. |
| 5 | Stato a tendina | 🟩 Già implementato. |
| 6 | Installatore a tendina | 🟨 Corretto localmente e verificato; da rilasciare. |
| 6 | Installatore visibile in alto | 🟩 Già implementato. |
| 6 | Campi personalizzati da UI | 🟨 Compilazione aggiunta e verificata; da rilasciare. |
| 6 | Spostamento campi | 🟦 Non implementato; regole da definire. |
| 7 | Calcoli impianto | 🟦 Non implementati; formule da definire. |
| 8 | Note Zoho | 🟩 Importazione già verificata, non modificata. |
| 8 | Menzioni note cliente | 🟩 Già implementate; aggiunti test invio email. |
| 8 | Leggibilità storico note | 🟩 Già implementata, non modificata. |
| 8 | Chi compila quali note | 🟥 Decisione organizzativa. |
| 9 | Rimozione obbligo tre documenti | 🟨 Testi residui corretti localmente; da rilasciare. |
| 9 | Doppie conversioni | 🟨 Protezioni implementate e testate localmente; migrazione e rilascio necessari. |
| 10 | Posizione/visibilità sopralluogo | 🟩 Già implementata, non modificata. |
| 10 | Salvataggio data sopralluogo | 🟨 Verificato localmente; da rilasciare e verificare integrato. |
| 11 | Email esistenti | 🟨 Test e SMTP locale superati; consegna in produzione ancora da verificare. |
| 11 | Testi/template email | 🟥 Servono modifiche approvate. |
| 11 | Automazioni attese | 🟥 Servono eventi/azioni definiti. Nessun nuovo flusso attivato. |
| 12 | Nome proprietario nelle schede | 🟩 Visualizzazione già implementata. |
| 12 | Proprietario sempre visibile | 🟩 Già implementato. |
| 12 | Filtro proprietario | 🟨 Backfill preparato e testato; da approvare e applicare. |
| 13 | Durata sessione | 🟩 Già verificata a 480 minuti, non modificata. |
| P.S. | Direttore → Agente | 🟥 Servono assegnazioni e conferma visibilità. |

## Ripetere i test locali

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build
```

`scripts/qa/report-vito-ui.mjs` avvia il collaudo UI su localhost:4179 (componenti reali, riferimenti fittizi e API in memoria). Non carica `.env`.

`scripts/qa/report-vito-sql.mjs` accetta come argomento il percorso assoluto al modulo `@electric-sql/pglite/dist/index.js`. PGlite 0.3.14 è stato installato solo in una cartella temporanea per queste prove; le dipendenze del progetto non sono cambiate. Nessuna connessione alla produzione.
