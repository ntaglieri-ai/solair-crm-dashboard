# Proposta commerciale per manutenzione e assistenza CRM Solair

Versione: bozza commerciale

Validita dell'offerta: 30 giorni dalla data di emissione.

Importi indicati al netto di IVA e di eventuali costi applicati da fornitori terzi.

## 1. Premessa

Il CRM Solair integra applicazione web, database, gestione documentale, automazioni, email, acquisizione lead, servizi esterni e assistente AI Roberta. La continuita del sistema dipende quindi non soltanto dal codice del CRM, ma anche dal corretto funzionamento di Vercel, Supabase, Nextcloud/Hetzner, Make, AWS SES, Meta, Aruba, Carbone, OpenAPI e dei servizi AI collegati.

La presente proposta offre tre livelli progressivi di presidio:

- **Base**, per assistenza reattiva e controlli essenziali;
- **Intermedio**, per prevenzione attiva e rilevamento tempestivo dei guasti;
- **Pro**, per continuita operativa, governance e ottimizzazione costante.

Il dettaglio generale delle attivita, delle responsabilita e delle esclusioni e descritto nel Piano generale di manutenzione, che costituisce parte integrante della proposta.

## 2. Sintesi dei piani

|  | Base | Intermedio | Pro |
|---|---|---|---|
| Posizionamento | Presidio minimo reattivo | Prevenzione attiva | Continuita e governance |
| Destinazione | Uso non critico o budget iniziale | Uso operativo quotidiano | CRM mission-critical per tutte le sedi |
| Verifica infrastruttura | Settimanale manuale | Monitoraggio automatico + verifica settimanale | Monitoraggio automatico + analisi periodica |
| Backup | Verifica settimanale | Verifica settimanale + retention/copertura | Verifica + restore test trimestrale |
| Integrazioni esterne | Su segnalazione | Controllo e alert | Controllo, alert e analisi ricorrenze |
| Gestione sito `solairgroup.it` | Esclusa | Inclusa, con assorbimento del canone annuale di manutenzione | Inclusa, con assorbimento del canone annuale di manutenzione |
| Sicurezza e dipendenze | Security fix critici su richiesta | Controllo mensile + security alert | Controllo esteso e revisione accessi |
| Qualita dati | Esclusa | Su richiesta | Audit mensile |
| Asset, token e scadenze | Esclusi | Scadenze critiche note | Registro completo e revisione mensile |
| Bot Roberta | Correttiva su segnalazione | Errori tecnici critici | Costi, tool, fonti e qualita operativa |
| Documentazione | Note essenziali dei fix | Runbook operativo | Runbook e registri completi |
| Report | Sintesi mensile | Report mensile | Report mensile avanzato |
| Ore incluse proposte | 3 ore/mese | 7 ore/mese | 14 ore/mese |
| Canone mensile proposto | **EUR 390** | **EUR 790** | **EUR 1.390** |

Il piano **Intermedio** e la soluzione raccomandata per l'attuale utilizzo del CRM Solair.

## 3. Piano Base - Presidio minimo reattivo

### Obiettivo

Fornire un livello essenziale di assistenza e verifica periodica, mantenendo il costo contenuto. Il piano e adatto quando Solair accetta che un'anomalia possa essere rilevata dagli utenti oppure durante il controllo settimanale.

### Attivita incluse

- verifica manuale settimanale di sito, CRM, Vercel, Supabase e Nextcloud;
- verifica passiva dell'ultimo backup Supabase e snapshot Nextcloud/Hetzner disponibile;
- ricezione e triage delle segnalazioni tecniche;
- manutenzione correttiva ordinaria entro il monte ore incluso;
- supporto utenti sul canale concordato;
- note sintetiche sugli interventi effettuati;
- riepilogo mensile di controlli, segnalazioni e ore utilizzate.

### Livello di servizio proposto

- fascia di servizio: giorni lavorativi, ore 09:00-18:00;
- presa in carico P1: entro 8 ore lavorative;
- presa in carico P2: entro 2 giorni lavorativi;
- presa in carico P3/P4: pianificazione nel backlog;
- monte ore: 3 ore mensili, non cumulabili;
- ore eccedenti: EUR 75/ora, previa autorizzazione.

### Limite operativo

Il piano non include monitoraggio automatico ne alert in tempo reale. Un guasto verificatosi tra due controlli puo rimanere inosservato fino alla verifica successiva o alla segnalazione di un utente.

### Corrispettivo

**EUR 390/mese**, oltre IVA.

Setup iniziale proposto: **EUR 350 una tantum**.

## 4. Piano Intermedio - Prevenzione attiva

### Obiettivo

Ridurre il tempo di rilevamento dei guasti e prevenire i rischi silenziosi legati a integrazioni, vulnerabilita e dipendenze. E il livello consigliato per un CRM utilizzato quotidianamente.

### Attivita incluse

Tutte le attivita del Piano Base, con in aggiunta:

- monitoraggio automatico di disponibilita e servizi critici;
- canale tecnico unico per gli alert;
- verifica settimanale degli alert e delle anomalie aperte;
- controllo di Make, SES/SMTP, Meta, Carbone, OpenAPI, CRM-Configuratore, CRM-Nextcloud e CRM-Roberta;
- verifica mensile delle policy RLS e dei principali privilegi Supabase;
- valutazione degli alert Dependabot o equivalenti;
- aggiornamenti di sicurezza prioritari;
- ciclo mensile per gli aggiornamenti ordinari compatibili;
- mantenimento del runbook operativo;
- controllo della retention e della copertura dei backup;
- gestione tecnica ordinaria del sito `solairgroup.it`;
- assorbimento nel canone mensile del precedente canone annuale di manutenzione del sito;
- report mensile con servizi, incidenti, integrazioni, sicurezza e ore utilizzate.

### Livello di servizio proposto

- monitoraggio automatico continuativo;
- fascia di presa in carico: giorni lavorativi, ore 09:00-18:00;
- presa in carico P1: entro 4 ore lavorative;
- presa in carico P2: entro 8 ore lavorative;
- presa in carico P3: entro 3 giorni lavorativi;
- monte ore: 7 ore mensili, non cumulabili;
- ore eccedenti: EUR 70/ora, previa autorizzazione.

La ricezione automatica degli alert opera continuativamente; la presa in carico umana segue la fascia di servizio indicata.

### Gestione del sito solairgroup.it

Il canone del Piano Intermedio include la gestione tecnica ordinaria del sito `solairgroup.it` e assorbe integralmente il relativo canone annuale di manutenzione, che non sara quindi fatturato separatamente per tutta la durata del piano.

La gestione comprende monitoraggio della disponibilita, verifiche tecniche, aggiornamenti ordinari, manutenzione correttiva e piccoli adeguamenti dei contenuti o della configurazione entro il monte ore incluso. Restano escluse nuove sezioni, redesign, campagne, produzione continuativa di contenuti e sviluppi evolutivi rilevanti.

Dominio, hosting, caselle email, licenze, servizi premium e altri costi vivi fatturati da provider terzi restano a carico di Solair, salvo diverso accordo scritto.

### Corrispettivo

**EUR 790/mese**, oltre IVA.

Setup iniziale proposto: **EUR 750 una tantum**, comprensivo di configurazione del canale alert, collegamento delle sorgenti e test iniziali.

## 5. Piano Pro - Continuita e governance

### Obiettivo

Presidiare il CRM come sistema centrale per le sedi Solair, includendo i fenomeni che degradano nel tempo senza produrre immediatamente un blocco: qualita dei dati, accessi, scadenze, costi e comportamento del bot.

### Attivita incluse

Tutte le attivita del Piano Intermedio, con in aggiunta:

- audit mensile della qualita dei dati;
- rilevazione di record anomali, duplicati, owner mancanti e valori incoerenti;
- registro completo di asset, account tecnici, accessi, token e scadenze;
- revisione mensile di rinnovi e rotazioni imminenti;
- revisione trimestrale degli accessi privilegiati;
- restore test trimestrale, nei limiti consentiti dai servizi attivi;
- revisione di RPO, RTO e procedura di ripristino;
- supervisione mensile del bot Roberta;
- controllo dei costi token e dell'utilizzo;
- analisi degli errori dei tool, delle richieste senza risposta e dei passaggi all'operatore;
- verifica delle fonti di conoscenza e della cache/listino;
- campionamento periodico delle conversazioni per individuare risposte problematiche;
- report avanzato con trend, rischi, azioni preventive e decisioni richieste a Solair;
- incontro mensile di allineamento fino a 60 minuti.

La gestione tecnica ordinaria di `solairgroup.it` e l'assorbimento del relativo canone annuale di manutenzione sono inclusi anche nel Piano Pro alle medesime condizioni indicate per il Piano Intermedio.

### Livello di servizio proposto

- monitoraggio automatico continuativo;
- fascia di presa in carico: giorni lavorativi, ore 08:30-18:30;
- presa in carico P1: entro 2 ore lavorative;
- presa in carico P2: entro 4 ore lavorative;
- presa in carico P3: entro 2 giorni lavorativi;
- monte ore: 14 ore mensili, di cui fino a 3 riportabili al mese successivo;
- ore eccedenti: EUR 65/ora, previa autorizzazione.

### Corrispettivo

**EUR 1.390/mese**, oltre IVA.

Setup iniziale proposto: **EUR 1.200 una tantum**, comprensivo di inventario iniziale, baseline tecnica, registro asset e prima verifica di sicurezza e qualita dati.

## 6. Manutenzione correttiva inclusa

Per tutti i piani il triage delle segnalazioni e incluso. La correzione rientra nel monte ore quando riguarda un malfunzionamento riproducibile rispetto al comportamento concordato del CRM.

Sono gestiti nel seguente ordine:

1. incidenti di sicurezza o rischio di perdita dati;
2. indisponibilita del CRM o blocco di funzioni critiche;
3. errori delle integrazioni operative;
4. problemi circoscritti con soluzione alternativa;
5. difetti minori.

Se la stima eccede le ore disponibili, Solair riceve una valutazione prima dell'intervento. Nessuna ora eccedente viene addebitata senza autorizzazione.

## 7. Attivita evolutive ed esclusioni

Non costituiscono manutenzione correttiva ordinaria:

- nuove funzionalita o modifiche ai processi aziendali;
- redesign dell'interfaccia;
- nuove integrazioni;
- migrazioni o bonifiche massive;
- aggiornamenti major che richiedono reingegnerizzazione;
- adeguamenti estesi imposti da cambiamenti dei provider;
- penetration test, audit legali o certificazioni;
- formazione strutturata;
- assistenza fuori fascia o reperibilita festiva;
- costi e consumi di Vercel, Supabase, Hetzner, Nextcloud, Make, AWS, Meta, Aruba, Carbone, OpenAPI, OpenAI, Anthropic o altri fornitori.

Queste attivita possono essere oggetto di preventivo o utilizzare le ore eccedenti soltanto previo accordo.

## 8. Protezione dei dati e GDPR

Solair rimane titolare del trattamento e mantiene la responsabilita delle decisioni relative a finalita, basi giuridiche, informative, consensi, tempi di conservazione, utenti autorizzati, richieste degli interessati e scelta dei fornitori.

Il manutentore:

- opera esclusivamente secondo le istruzioni e le autorizzazioni ricevute da Solair;
- adotta misure tecniche adeguate agli accessi concessi;
- non utilizza i dati per finalita autonome;
- supporta tecnicamente l'applicazione delle policy definite da Solair;
- limita dati personali e segreti presenti in log, alert e strumenti AI;
- segnala senza ingiustificato ritardo possibili violazioni o esposizioni rilevate;
- non esegue cancellazioni, esportazioni o modifiche massive senza autorizzazione.

Qualora il manutentore tratti dati personali per conto di Solair, il rapporto sara disciplinato, ove necessario, tramite nomina a responsabile del trattamento ai sensi dell'art. 28 GDPR.

Il servizio non comprende consulenza legale o assunzione delle responsabilita proprie del titolare del trattamento.

## 9. Condizioni economiche

- fatturazione: mensile anticipata;
- durata iniziale proposta: 12 mesi;
- recesso: preavviso di 30 giorni dopo il periodo iniziale;
- ore incluse: destinate alle sole attivita previste dal piano;
- consuntivo: riepilogo delle ore nel report mensile;
- ore eccedenti: eseguite esclusivamente previa approvazione di Solair;
- attivita fuori orario: quotate separatamente;
- costi provider: esclusi e sostenuti direttamente da Solair;
- canone annuale di manutenzione di `solairgroup.it`: assorbito e non fatturato separatamente con Piano Intermedio o Pro;
- revisione del canone: possibile in caso di variazione sostanziale di utenti, sedi, integrazioni, volumi o perimetro.

## 10. Opzioni aggiuntive

| Opzione | Corrispettivo proposto |
|---|---:|
| Pacchetto 5 ore aggiuntive prepagate | EUR 325 |
| Pacchetto 10 ore aggiuntive prepagate | EUR 600 |
| Intervento urgente fuori fascia, se disponibile | EUR 120/ora, minimo 2 ore |
| Restore test aggiuntivo | Da EUR 350 |
| Formazione utenti da remoto, fino a 2 ore | EUR 250 |
| Audit tecnico straordinario con relazione | Da EUR 600 |

## 11. Confronto economico

| Piano | Canone mensile | Setup iniziale | Ore incluse | Valore annuale canoni |
|---|---:|---:|---:|---:|
| Base | EUR 390 | EUR 350 | 3/mese | EUR 4.680 |
| Intermedio | EUR 790 | EUR 750 | 7/mese | EUR 9.480 |
| Pro | EUR 1.390 | EUR 1.200 | 14/mese | EUR 16.680 |

Gli importi sono al netto di IVA e dei costi dei servizi esterni.

## 12. Raccomandazione

Per l'attuale architettura e per l'uso quotidiano del CRM, si raccomanda il **Piano Intermedio**. Offre un equilibrio tra costo e riduzione del rischio: consente di rilevare tempestivamente indisponibilita e guasti delle integrazioni, mantenendo sotto controllo sicurezza e dipendenze.

Il Piano Base rimane utilizzabile come presidio iniziale, accettando esplicitamente un maggiore tempo di rilevamento. Il Piano Pro diventa indicato quando il CRM e riconosciuto come sistema mission-critical per tutte le sedi o quando qualita dei dati e Roberta incidono direttamente sui processi commerciali.

## 13. Accettazione

Piano scelto: Base / Intermedio / Pro

Data di avvio: ____________________

Referente Solair: ____________________

Referente tecnico: ____________________

Per Solair: ____________________

Per il manutentore: ____________________
