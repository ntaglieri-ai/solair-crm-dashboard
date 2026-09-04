# Verifica filtri e menzioni nelle note interne — 4 settembre 2026

## Filtri: verifica online, senza modificare dati

Base verificata su GitHub: `main` e `develop` a `af2581c`.

| Controllo | Esito |
| --- | --- |
| Migrazione `20260904d_crm_stato_cliente.sql` | Presente: 11 stati attivi nel DB e nella tendina online. |
| Stato Logistica | 66 risultati, corrispondenti ai valori esatti nel DB. |
| Logistica + proprietario Vito Ragaglia | 7 risultati sia nell'interfaccia sia nella query SQL. I due filtri si combinano in AND. |
| Stati multipli importati | Aperto: 30 clienti hanno stati separati da `;`. Per Logistica i risultati diventerebbero 80 includendo i multistato; il filtro `.eq` ne restituisce 66. |
| Stato assente | Aperto: 12 clienti con `stato IS NULL`, mostrati dal mapping come “Attesa cliente”. Non esiste una corrispondente opzione nella nuova lista. |

Nessuna modifica a logica o dati dei filtri in questa run. Il controllo non certifica un editor di filtri AND/OR stile Zoho.

## Menzioni interne implementate

- Scrittura con `@`, suggerimenti e selezione da tastiera, creazione/modifica, salvataggio e rilettura degli offset; nessuna alterazione degli spazi che sposterebbe le menzioni.
- Metadati nella sola `cliente_note_interne`, mai in `attivita` o nelle note cliente ordinarie.
- Destinatari attivi con account collegato, ruolo ammesso dal gate SQL, permesso note interne, accesso alla pagina cliente e al suo proprietario/team. Revoche e configurazioni ambigue non vengono ignorate.
- Elenco per cliente senza cache condivisa con le note pubbliche; solo id/nome esposti al browser. Controllo server ripetuto al salvataggio e prima delle notifiche.
- Email inviata dopo il salvataggio con il testo scritto nella nota (inclusi spazi e a capo), senza messaggi sostitutivi, pulsanti o link automatici al CRM. Il testo HTML è escapato; nessun accesso aggiuntivo viene concesso dalla menzione.
- Alla modifica si notificano solo i nuovi destinatari; niente auto-notifica o duplicati dello stesso utente nella stessa nota. La modifica usa un controllo di concorrenza sul timestamp letto.
- Un errore email non rende fallito il salvataggio già eseguito; il browser mostra un avviso. Un errore di salvataggio conserva la bozza aperta.
- Soft delete conservato. I nomi nelle note interne sono evidenziati ma non aprono il compositore email generico delle note ordinarie.

## Verifiche

- 240 test passati in 28 file: guard, permessi/scope destinatari, input contraffatto, persistenza, testo email fedele senza link aggiunti, errori SMTP, destinatari già notificati, conflitti di aggiornamento e suite preesistente.
- PostgreSQL isolato (`scripts/qa/internal-notes-sql.mjs`): 6 controlli su migrazione ripetibile, default per le note esistenti, vincolo JSON array, persistenza e RLS invariata.
- Browser isolato (`node scripts/qa/internal-notes-ui.mjs`): componente reale con API in memoria, nessun collegamento al CRM/SMTP. Verificati suggerimenti, selezione da tastiera, salvataggio/rilettura, errore PATCH con bozza conservata, avviso email, eliminazione, invisibilità per AGENT; nessun errore console nel controllo finale.
- Typecheck, lint sui file applicativi modificati e build Next.js.
- Aggiornato l'argomento degli stati nel test `edit-values.test.ts`, rimasto indietro rispetto alla firma introdotta da `94a141c`.

Nessuna email reale inviata, nessuna nota di produzione creata/modificata. Il collaudo end-to-end sul deployment richiede migrazione e deploy; i test browser isolati non lo sostituiscono.

## Rilascio

1. Applicare **solo** `supabase/migrations/20260904e_note_interne_menzioni.sql` sul database destinazione. Aggiunge la colonna `menzioni` con default `[]` e il vincolo array; nessun nuovo grant/policy. Non è la migrazione degli stati già applicata.
2. Pubblicare il commit di questa run da `develop` con la consueta procedura Vercel. Non distribuire il codice nuovo prima della colonna.
3. Ricaricare il CRM. Provare una menzione con un destinatario di collaudo autorizzato, quindi verificare rilettura e ricezione email.

La migrazione delle menzioni è preparata ma **non applicata in produzione da questa run**. Nessun push su `main` e nessuna promozione Vercel effettuati.
