# Piano generale di manutenzione, assistenza e continuita operativa CRM Solair

Stato: proposta generale da articolare successivamente nei piani Base, Intermedio e Pro.

## 1. Finalita

Il presente piano definisce il perimetro generale delle attivita necessarie a mantenere il CRM Solair e i servizi collegati disponibili, sicuri, aggiornati e operativamente affidabili.

Il documento costituisce un catalogo generale dei servizi. Frequenze, tempi di presa in carico, monte ore, attivita incluse e costi saranno assegnati nei singoli piani commerciali Base, Intermedio e Pro.

Gli obiettivi sono:

- ridurre il rischio di indisponibilita e perdita dei dati;
- rilevare e gestire tempestivamente anomalie tecniche;
- mantenere affidabili le integrazioni con i servizi esterni;
- prevenire il deterioramento di sicurezza, dati e configurazioni;
- fornire supporto agli utenti e mantenere aggiornata la documentazione;
- garantire tracciabilita delle verifiche e degli interventi.

## 2. Perimetro tecnico

Il presidio puo comprendere, secondo il piano sottoscritto:

- applicazione CRM e sito sviluppati in Next.js e distribuiti su Vercel;
- database, autenticazione, storage e policy di accesso Supabase;
- Nextcloud e relativa infrastruttura Hetzner;
- Make e altri flussi di automazione;
- AWS SES/SMTP e invii email applicativi;
- Aruba per dominio, DNS, caselle e servizi collegati;
- Meta webhook e acquisizione lead;
- Carbone e OpenAPI per documenti e firme;
- collegamenti CRM-Configuratore, CRM-Nextcloud e altri webhook applicativi;
- bot Roberta, fonti di conoscenza, tool e servizi AI OpenAI/Anthropic;
- repository, dipendenze software, procedure di deploy e documentazione tecnica.

Licenze, canoni, consumi e servizi acquistati presso provider terzi restano esclusi dal compenso di manutenzione, salvo indicazione espressa nel singolo piano.

## 3. Ruoli e responsabilita

| Soggetto | Responsabilita principali |
|---|---|
| Solair | Titolare delle decisioni sul CRM e sui dati; definisce finalita, basi giuridiche, tempi di conservazione, utenti autorizzati e policy interne; fornisce accessi e approva cambi critici, costi e interventi straordinari. |
| Manutentore tecnico | Esegue le attivita incluse nel piano, monitora o verifica i servizi, effettua triage, manutenzione correttiva e preventiva, documenta gli esiti e segnala rischi o decisioni necessarie. |
| Provider esterni | Erogano i rispettivi servizi e rendono disponibili dashboard, log, backup, notifiche e assistenza secondo i propri contratti e SLA. |
| Utenti Solair | Utilizzano il CRM secondo le procedure interne, proteggono le credenziali e segnalano tempestivamente errori, usi impropri o anomalie sui dati. |

Il manutentore non assume autonomia sulle finalita e modalita del trattamento dei dati. Eventuali operazioni sui dati personali sono svolte esclusivamente su istruzione di Solair e nei limiti degli accessi e delle attivita autorizzate.

## 4. Ambiti del servizio

### 4.1 Monitoraggio dell'infrastruttura

Controllo della disponibilita e dello stato dei servizi principali: sito, CRM, Vercel, Supabase, Nextcloud e componenti infrastrutturali collegati.

Le attivita possono comprendere:

- check manuali periodici;
- monitoraggio automatico e alert;
- verifica dei deploy e degli errori applicativi;
- triage delle anomalie;
- verifica della risoluzione e registrazione dell'esito.

Il monitoraggio automatico continuo non equivale a presidio umano continuativo. Fasce di servizio e tempi di presa in carico sono definiti nel piano sottoscritto.

### 4.2 Backup, ripristino e continuita operativa

Verifica dei backup Supabase e degli snapshot Nextcloud/Hetzner gia prodotti dai rispettivi sistemi.

Secondo il livello di servizio possono essere inclusi:

- verifica dell'ultimo backup o snapshot disponibile;
- controllo dell'esito, della retention e dei sistemi coperti;
- segnalazione di backup mancanti o non validi;
- test periodici di ripristino;
- definizione e revisione di RPO e RTO;
- aggiornamento della procedura di disaster recovery.

L'attivazione di PITR, retention aggiuntiva o servizi infrastrutturali premium richiede approvazione di Solair e rimane a suo carico, salvo diverso accordo.

### 4.3 Integrazioni esterne

Controllo delle integrazioni critiche, tra cui Make, SES/SMTP, Aruba DNS, Meta, Carbone, OpenAPI, Configuratore, Nextcloud e Roberta.

Il controllo puo riguardare:

- raggiungibilita del servizio;
- esito delle ultime esecuzioni;
- webhook falliti o non ricevuti;
- errori di autenticazione e token scaduti;
- code, sincronizzazioni o elaborazioni bloccate;
- errori di invio email o generazione documenti;
- fix ordinari oppure escalation al provider o a Solair.

### 4.4 Sicurezza applicativa e infrastrutturale

Le attivita di sicurezza possono includere:

- verifica periodica delle policy RLS Supabase;
- controllo dei privilegi di funzioni, ruoli e service account;
- valutazione degli alert Dependabot o equivalenti;
- verifica di account amministrativi, MFA e utenti non piu necessari;
- controllo delle route pubbliche, webhook, upload e rate limiting;
- verifica che log e notifiche non contengano segreti o dati non necessari;
- rotazione pianificata di password, token e chiavi API;
- gestione prioritaria delle vulnerabilita critiche.

Audit specialistici, penetration test, certificazioni e attivita forensi non sono inclusi se non espressamente indicati.

### 4.5 Qualita e coerenza dei dati

Esecuzione di controlli periodici su:

- valori enum e campi categorici non validi;
- record senza owner o relazioni obbligatorie;
- duplicati e dati incompleti;
- record anomali o non sincronizzati;
- incongruenze introdotte da importazioni o integrazioni.

Il manutentore produce un elenco delle anomalie e una proposta di correzione. Bonifiche massive, cancellazioni e modifiche con impatto operativo richiedono preventiva validazione di Solair.

### 4.6 Asset, accessi, scadenze e credenziali

Mantenimento di un registro contenente, senza riportare segreti in chiaro:

- domini, DNS, hosting e servizi infrastrutturali;
- account tecnici e relativi owner;
- API key, token OAuth e app-password;
- servizi email, Meta, Make, Vercel, Supabase, Nextcloud e servizi AI;
- scadenze, rinnovi e rotazioni pianificate;
- stato degli accessi amministrativi.

Il manutentore segnala le scadenze. Approvazione dei rinnovi, pagamento dei provider e conferma degli owner restano responsabilita di Solair.

### 4.7 Aggiornamenti e dipendenze

Gestione degli aggiornamenti software secondo rischio e priorita:

- patch di sicurezza valutate con priorita;
- aggiornamenti ordinari raggruppati in cicli periodici;
- test tecnici prima del rilascio;
- gestione delle PR automatiche;
- rinvio motivato degli aggiornamenti incompatibili o rischiosi;
- aggiornamenti major o migrazioni rilevanti sottoposti a stima separata quando eccedono la manutenzione ordinaria.

### 4.8 Manutenzione correttiva e interventi ad hoc

La manutenzione correttiva comprende triage, diagnosi e correzione dei malfunzionamenti riproducibili rispetto al comportamento concordato del sistema.

Il flusso ordinario prevede:

1. ricezione dell'alert o della segnalazione;
2. classificazione di priorita e impatto;
3. riproduzione e diagnosi;
4. fix nel ramo di sviluppo previsto;
5. test proporzionati al rischio;
6. rilascio secondo il workflow concordato;
7. registrazione dell'esito.

Il triage puo essere sempre incluso; l'esecuzione del fix resta soggetta al monte ore e al perimetro del piano. Evolutive, nuove funzioni, reingegnerizzazioni, migrazioni, bonifiche massive e adeguamenti rilevanti a provider esterni sono oggetto di valutazione separata.

### 4.9 Supporto utenti e helpdesk

Gestione on demand delle richieste sul canale concordato:

- raccolta e classificazione della segnalazione;
- assistenza sull'uso del CRM;
- distinzione tra errore, problema dati e richiesta evolutiva;
- escalation tecnica quando necessaria;
- rilevazione di casi ricorrenti da includere nel report.

Formazione strutturata, manuali estesi e presidio dedicato sono esclusi, salvo previsione specifica.

### 4.10 Documentazione e runbook

Aggiornamento delle procedure operative quando cambiano servizi o configurazioni, inclusi:

- runbook di intervento;
- procedure di deploy e rollback;
- procedure di backup e ripristino;
- note su accessi, asset e owner;
- procedure delle integrazioni;
- documentazione tecnica nel repository o nello spazio documentale indicato da Solair.

### 4.11 Supervisione e manutenzione del bot Roberta

Controllo tecnico e operativo del bot, eventualmente comprendente:

- consumo e costo dei token;
- errori dei tool, inclusi `crea_lead` e `richiedi_contatto_umano`;
- disponibilita e aggiornamento delle fonti di conoscenza;
- hit rate della cache e utilizzo del listino;
- richieste senza risposta o passaggi all'operatore;
- campionamento delle conversazioni e rilevazione di risposte problematiche;
- proposta di correzioni a prompt, fonti e configurazioni.

Il bot non deve essere considerato una fonte autoritativa e le decisioni commerciali o operative rilevanti rimangono in capo a Solair e ai suoi utenti.

### 4.12 Protezione dei dati personali e supporto GDPR

Solair mantiene il ruolo di titolare del trattamento e resta responsabile di:

- determinare finalita e basi giuridiche del trattamento;
- approvare informative, consensi e tempi di conservazione;
- autorizzare utenti, ruoli e accessi;
- gestire le richieste degli interessati;
- scegliere e contrattualizzare responsabili e sub-responsabili;
- approvare trasferimenti, cancellazioni, esportazioni e utilizzi dei dati nei servizi AI;
- valutare la necessita di DPIA, registro dei trattamenti e altri adempimenti legali.

Il manutentore fornisce supporto tecnico e organizzativo nei limiti del piano, ad esempio:

- implementazione delle istruzioni e policy definite da Solair;
- verifica tecnica di ruoli, permessi e tracciabilita;
- supporto a esportazione, rettifica, cancellazione o anonimizzazione;
- configurazione delle retention approvate;
- minimizzazione dei dati presenti in log, alert e servizi AI;
- segnalazione tempestiva di possibili violazioni o esposizioni;
- conservazione della documentazione tecnica delle misure adottate.

Quando il manutentore accede o tratta dati personali per conto di Solair, ruoli, istruzioni, riservatezza e misure di sicurezza dovranno essere disciplinati nell'accordo applicabile, inclusa ove necessaria la nomina a responsabile del trattamento ai sensi dell'art. 28 GDPR.

Il servizio di manutenzione non costituisce consulenza legale ne trasferisce al manutentore la responsabilita propria del titolare del trattamento.

## 5. Gestione di alert e incidenti

Gli alert tecnici confluiscono, ove previsto, in un canale unico. Supporto ordinario, esiti positivi dei controlli e reminder amministrativi restano separati per evitare rumore operativo.

Classificazione proposta:

| Priorita | Descrizione | Esempi |
|---|---|---|
| P1 - Critica | Servizio indisponibile, rischio concreto di perdita dati o incidente di sicurezza grave. | CRM irraggiungibile, database compromesso, accesso non autorizzato. |
| P2 - Alta | Funzione critica bloccata senza soluzione alternativa adeguata. | Lead non acquisiti, documenti o email operative ferme. |
| P3 - Media | Funzione degradata con workaround o impatto limitato. | Singola integrazione non critica, errore circoscritto. |
| P4 - Bassa | Problema minore, richiesta informativa o miglioramento. | Difetto cosmetico, ottimizzazione non urgente. |

I tempi di presa in carico e gli eventuali tempi obiettivo di ripristino saranno definiti per ciascun piano. Tali tempi decorrono nella fascia di servizio concordata, salvo copertura fuori orario espressamente prevista.

Per incidenti rilevanti o ricorrenti il registro dovrebbe riportare causa, impatto, workaround, soluzione e azioni preventive.

## 6. Controlli e frequenze di riferimento

| Frequenza | Attivita tipiche |
|---|---|
| Continuativa | Uptime, deploy falliti, errori critici, webhook, job e security alert, ove inclusi. |
| Settimanale | Stato servizi, backup, integrazioni critiche, bot e anomalie aperte. |
| Mensile | Sicurezza, dipendenze, qualita dati, accessi, asset, costi e trend. |
| Trimestrale | Test di ripristino, revisione accessi privilegiati e procedure di emergenza, ove inclusi. |
| Semestrale | Revisione di continuita operativa, architettura e fornitori, ove inclusa. |
| On demand | Bug, assistenza utenti, incidenti e aggiornamenti documentali. |

Le frequenze effettive dipendono dal piano acquistato.

## 7. Registri e reportistica

Il servizio utilizza, in funzione del piano:

- registro dei controlli periodici;
- registro degli incidenti e degli interventi;
- registro di asset, accessi e scadenze;
- backlog delle anomalie e delle decisioni aperte;
- report periodico sintetico.

Il report puo includere:

- stato dei servizi;
- incidenti, cause e tempi di gestione;
- backup e restore test;
- integrazioni ok/ko;
- vulnerabilita e aggiornamenti;
- anomalie dei dati;
- richieste di supporto ricorrenti;
- utilizzo e costi del bot;
- attivita effettuate, ore consumate e azioni richieste a Solair.

Registri e report non devono contenere password, token, chiavi API o dati personali non necessari.

## 8. Esclusioni generali

Salvo diversa indicazione nel piano o in un preventivo, sono esclusi:

- nuove funzionalita e modifiche evolutive;
- redesign o reingegnerizzazione dell'applicazione;
- migrazioni massive e bonifiche estese dei dati;
- penetration test, audit legali e certificazioni;
- consulenza legale, fiscale o privacy;
- costi, licenze e consumi dei provider;
- interventi resi necessari da modifiche straordinarie dei fornitori;
- recupero dati non disponibile nei backup contrattualizzati;
- assistenza fuori fascia o reperibilita non prevista;
- formazione strutturata degli utenti;
- interventi su dispositivi, rete locale o sistemi non elencati nel perimetro.

## 9. Dipendenze e condizioni operative

L'erogazione del servizio presuppone:

- accessi tecnici adeguati e mantenuti validi da Solair;
- disponibilita dei log e delle dashboard dei provider;
- collaborazione degli utenti nella descrizione e riproduzione dei problemi;
- approvazione tempestiva di cambi critici, rinnovi e costi esterni;
- ambienti e workflow di sviluppo/deploy utilizzabili;
- disponibilita di backup coerenti con i servizi acquistati presso i provider.

Ritardi o indisponibilita imputabili a provider, accessi mancanti o decisioni pendenti di Solair sospendono i relativi tempi operativi.

## 10. Parametri da definire nei tre piani

Per ciascun piano Base, Intermedio e Pro dovranno essere indicati:

- ambiti inclusi e profondita del controllo;
- frequenza delle verifiche;
- presenza o meno del monitoraggio automatico;
- fascia di servizio;
- tempi di presa in carico per priorita;
- monte ore mensile incluso e regole di riporto;
- costo delle ore eccedenti;
- numero di utenti o canali supportati;
- frequenza del report;
- restore test e attivita GDPR incluse;
- reperibilita o interventi fuori orario;
- canone mensile o annuale;
- costi una tantum di setup iniziale.

## 11. Struttura commerciale proposta

La successiva articolazione dovrebbe seguire questa logica:

- **Base - presidio reattivo:** verifiche essenziali, controllo backup, triage e assistenza su richiesta;
- **Intermedio - prevenzione attiva:** monitoraggio automatico, integrazioni, sicurezza, aggiornamenti e runbook;
- **Pro - continuita e governance:** qualita dati, asset e accessi, restore test, supervisione del bot e reporting avanzato.

La ripartizione definitiva e i relativi costi saranno definiti in un documento commerciale separato, senza modificare responsabilita, esclusioni e principi generali stabiliti nel presente piano.
