# Proposta commerciale CRM Solair - Piani Minimal

Versione: bozza semplificata

Importi al netto di IVA. Costi, licenze e consumi dei provider esterni sono esclusi.

## Obiettivo

I Piani Minimal garantiscono un presidio tecnico essenziale del CRM e delle connessioni piu importanti, mantenendo un canone contenuto.

In tutti i piani sono monitorati:

- disponibilita del CRM;
- collegamento CRM-Nextcloud;
- stato degli scenari Make concordati;
- ricezione e funzionamento del webhook Meta;
- disponibilita tecnica del bot Roberta.

Il monitoraggio genera alert automatici. Il canone comprende la verifica dell'alert e un primo triage tecnico; eventuali interventi correttivi sono svolti previa autorizzazione e fatturati separatamente, salvo le piccole attivita espressamente incluse nel piano.

Il monitoraggio automatico non equivale a reperibilita continuativa. Gli alert sono presi in carico nei giorni lavorativi e nella fascia 09:00-18:00.

## Confronto sintetico

| Servizio | Base Minimal | Medio Minimal | Pro Minimal |
|---|---|---|---|
| CRM online | Monitoraggio | Monitoraggio | Monitoraggio |
| CRM-Nextcloud | Monitoraggio connessione | Monitoraggio + verifica anomalie | Monitoraggio + verifica anomalie |
| Scenari Make | Stato up/down | Stato ed errori | Stato, errori e controllo periodico |
| Meta webhook | Stato up/down | Stato ed errori | Stato, errori e controllo periodico |
| Bot Roberta | Stato up/down | Stato ed errori tecnici | Stato, errori e controllo consumi |
| Backup | Escluso | Verifica mensile | Verifica mensile |
| Sicurezza | Alert critici ricevuti | Dependabot security | Dependabot + controllo essenziale mensile |
| `solairgroup.it` | Escluso | Gestione essenziale inclusa | Gestione essenziale inclusa |
| Report | Solo anomalie | Sintesi mensile | Sintesi mensile estesa |
| Canone | **EUR 100/mese** | **EUR 160/mese** | **EUR 220/mese** |

## Base Minimal - EUR 100/mese

Presidio automatico essenziale per sapere se i servizi critici sono raggiungibili.

### Incluso

- monitoraggio automatico della disponibilita del CRM;
- monitoraggio della connessione CRM-Nextcloud;
- monitoraggio dello stato degli scenari Make concordati;
- monitoraggio del webhook Meta;
- monitoraggio della disponibilita tecnica del bot Roberta;
- ricezione degli alert su un canale tecnico unico;
- primo triage degli alert nei giorni lavorativi;
- comunicazione a Solair delle anomalie che richiedono un intervento.

### Non incluso

- controlli manuali periodici;
- verifica backup;
- gestione del sito `solairgroup.it`;
- correzioni, aggiornamenti e modifiche al codice;
- supporto ordinario agli utenti;
- analisi dei dati o della qualita delle risposte del bot.

### Tempi indicativi

- alert critico: verifica entro il giorno lavorativo successivo;
- altri alert: verifica entro 2 giorni lavorativi.

## Medio Minimal - EUR 160/mese

Presidio essenziale con una verifica periodica e gestione minima del sito istituzionale.

### Incluso

Tutto il Base Minimal, piu:

- verifica settimanale sintetica degli alert aperti;
- controllo degli errori tecnici di Nextcloud, Make, Meta e Roberta;
- verifica mensile dell'esistenza dell'ultimo backup Supabase e snapshot Nextcloud disponibile;
- ricezione e valutazione degli alert di sicurezza Dependabot;
- breve riepilogo mensile di stato e anomalie;
- gestione tecnica essenziale di `solairgroup.it`;
- assorbimento del precedente canone annuale di manutenzione del sito.

La gestione del sito comprende monitoraggio della disponibilita e piccoli interventi correttivi compatibili con il presidio minimal. Nuove pagine, redesign, campagne, produzione di contenuti e sviluppi evolutivi sono esclusi.

### Tempi indicativi

- alert critico: verifica entro 8 ore lavorative;
- altri alert: verifica entro 2 giorni lavorativi.

## Pro Minimal - EUR 220/mese

Presidio minimal piu completo, con maggiore attenzione a sicurezza, scadenze e consumi del bot.

### Incluso

Tutto il Medio Minimal, piu:

- controllo mensile essenziale degli alert e delle configurazioni di sicurezza piu critiche;
- verifica mensile di token e scadenze tecniche note per i servizi monitorati;
- controllo mensile dei consumi tecnici del bot Roberta;
- segnalazione di errori ricorrenti dei tool del bot;
- controllo mensile sintetico delle principali anomalie operative;
- report mensile con stato servizi, backup, sicurezza, bot e azioni aperte;
- fino a 30 minuti mensili di piccola manutenzione tecnica, non cumulabili.

La gestione tecnica essenziale di `solairgroup.it` e l'assorbimento del relativo canone annuale sono inclusi alle medesime condizioni del Medio Minimal.

### Tempi indicativi

- alert critico: verifica entro 4 ore lavorative;
- altri alert: verifica entro il giorno lavorativo successivo.

## Interventi e assistenza extra

Il triage determina causa probabile, impatto e intervento necessario. Quando occorre modificare codice, dati o configurazioni, viene richiesta l'autorizzazione di Solair prima di procedere.

Tariffa proposta per le attivita non incluse: **EUR 65/ora**, con fatturazione minima di 30 minuti.

Sono sempre quotati separatamente:

- nuove funzionalita;
- modifiche evolutive;
- nuove integrazioni;
- migrazioni e bonifiche massive;
- redesign e nuove sezioni del sito;
- interventi fuori orario;
- costi richiesti dai provider esterni.

## Backup

La verifica inclusa nei piani Medio Minimal e Pro Minimal e passiva: controlla che il provider mostri un backup o snapshot recente e senza errori evidenti. Non comprende test di ripristino, PITR o garanzia di recuperabilita dei dati.

## GDPR e responsabilita sui dati

Solair rimane titolare del trattamento e responsabile delle decisioni relative ai dati, incluse finalita, basi giuridiche, conservazione, autorizzazioni, richieste degli interessati e scelta dei fornitori.

Il manutentore opera soltanto su istruzione di Solair, limita l'accesso ai dati a quanto tecnicamente necessario e segnala eventuali esposizioni o anomalie rilevate. Cancellazioni, esportazioni e modifiche massive richiedono autorizzazione di Solair.

Il servizio non comprende consulenza legale o privacy. Ove necessario, l'accesso ai dati da parte del manutentore sara regolato tramite nomina a responsabile del trattamento ai sensi dell'art. 28 GDPR.

## Condizioni essenziali

- fatturazione mensile anticipata;
- durata iniziale consigliata: 12 mesi;
- canoni al netto di IVA;
- licenze, hosting, dominio e consumi dei provider a carico di Solair;
- nessuna reperibilita notturna, festiva o continuativa;
- interventi extra eseguiti soltanto previa autorizzazione;
- per Medio Minimal e Pro Minimal il precedente canone annuale di manutenzione di `solairgroup.it` non viene fatturato separatamente.
