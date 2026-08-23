# Mappa fornitori e subprocessor

**Rilevato il**: 23 agosto 2026, sul codice del branch `develop`, sulle
variabili d'ambiente di **produzione** (`vercel env ls production`) e sulla
tabella `integrazioni` del database di produzione.

**Natura del documento**: ricognizione tecnica di quali servizi esterni sono
effettivamente collegati e quali dati li raggiungono. **Non è una valutazione
legale.** Lo stato dei DPA non è deducibile dal codice: dove non è noto è
scritto **"da verificare con Nando"**, senza supposizioni.

**Criterio di verifica usato**: un servizio è considerato *attivo in
produzione* solo se (a) esiste codice che lo chiama e (b) le credenziali
necessarie sono presenti nell'ambiente Production di Vercel. Le credenziali
presenti solo in `.env.local` indicano un servizio configurato in locale ma
**non operante in produzione**.

## Riepilogo

| Fornitore | Ruolo | Attivo in produzione | Dati personali che lo raggiungono | DPA |
|---|---|---|---|---|
| Vercel | hosting ed esecuzione | **sì** | tutti, in transito | da verificare con Nando |
| Supabase | database e autenticazione | **sì** | tutti, a riposo | da verificare con Nando |
| Hetzner (Nextcloud Storage Share) | archiviazione documenti | **sì** | documenti di identità, contratti, bollette | da verificare con Nando |
| Amazon Web Services (SES) | invio email | **sì** | email e nome dei destinatari, corpo del messaggio | da verificare con Nando |
| Meta (Facebook/Instagram) | acquisizione lead | **sì** | dati di contatto dei lead in ingresso | da verificare con Nando |
| Pabbly | ponte Meta → CRM | **probabile** | stessi dati dei lead Meta | da verificare con Nando |
| Anthropic | estrazione testo da listini | **no** (chiave assente in produzione) | nessuno: solo listini prodotto | da verificare con Nando |
| Twilio | WhatsApp | **no** (credenziali assenti in produzione) | nessuno oggi | da verificare con Nando |
| Make.com | automazioni | **no** (integrazione disattivata, webhook vuoto) | nessuno oggi | da verificare con Nando |
| OpenAPI eSignature | firma elettronica | **no** (integrazione disattivata, token vuoto) | nessuno oggi | da verificare con Nando |
| Zoho CRM | sistema di origine | **no** (ultimo run 15/08/2026 in `dry_run`) | storico già importato | da verificare con Nando |

---

## Attivi in produzione

### Vercel — hosting ed esecuzione applicativa

Progetto `mostagstudio/solair-crm-dashboard`. Funzioni eseguite in `fra1`
(**Francoforte**), come da `vercel.json`.

Dati che lo attraversano: **tutti**. Ogni richiesta al CRM passa dalle Vercel
Functions. Nessuna persistenza applicativa su Vercel; i log di piattaforma
possono contenere frammenti di richiesta.

Nota: Vercel è anche il custode delle credenziali di tutti gli altri servizi
(vedi § "Osservazione sulle variabili d'ambiente").

**DPA: da verificare con Nando.**

### Supabase — database, autenticazione, storage strutturato

Progetto `solair-crm` (ref `ayyazgtqsocwvucbvega`), regione `eu-central-1`
(**Francoforte**). Infrastruttura sottostante AWS.

Dati: l'intero contenuto del CRM — 9.365 lead, 16 clienti, 2.346 compiti, 30
utenti, credenziali cifrate, registro di audit. Vedi il
[registro dei trattamenti](./registro-trattamenti.md).

Da tenere presente: Supabase è a sua volta appoggiato ad AWS, quindi la catena
è Solair → Supabase → AWS. **Da verificare con Nando** se il DPA con Supabase
copra esplicitamente questo sub-affidamento.

**DPA: da verificare con Nando.**

### Hetzner — Nextcloud Storage Share

Istanza `nx101824.your-storageshare.de` (Hetzner Storage Share, **Germania**).
Riga `integrazioni` "Nextcloud Storage" con `attivo: true`.

Dati: gli allegati dei record. È il sistema che contiene i documenti più
sensibili dell'intero perimetro — nella sottocartella "documenti obbligatori"
di ogni lead finiscono **documento d'identità, bolletta e visura**.

Accesso applicativo tramite account amministrativo (`NEXTCLOUD_ADMIN_USER`) e
app-password per utente, cifrate in `nextcloud_credentials`.

**DPA: da verificare con Nando.** Nota che il fornitore contrattuale potrebbe
essere Hetzner (infrastruttura) o un rivenditore del servizio Storage Share:
da chiarire chi è la controparte del contratto.

### Amazon Web Services — SES (Simple Email Service)

`SMTP_HOST = email-smtp.eu-west-1.amazonaws.com`, porta 465, mittente
`commerciale@solairgroup.it`. Regione `eu-west-1` — **Irlanda**.

> **Correzione rispetto all'assunto iniziale**: il canale email non è Aruba.
> È Amazon SES. Se esiste un contratto Aruba, riguarda altro (dominio, caselle
> di posta), non il transito delle email del CRM.

Dati: indirizzo email e nome del destinatario (lead o cliente), oggetto e corpo
del messaggio, per ogni invio singolo o massivo. Il corpo è composto nel CRM e
può contenere qualunque dato l'operatore vi inserisca.

Nota operativa rilevante: **nessun percorso di invio verifica i campi di
consenso** `consenso_contatto_email`. Vedi
[stato privacy by design](./privacy-by-design-stato.md), punto 8.

**DPA: da verificare con Nando.**

### Meta — Facebook / Instagram Lead Ads

Credenziali presenti in Production: `META_PAGE_ACCESS_TOKEN`,
`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_VERSION`.
Endpoint applicativi: `app/api/meta/webhook`, `app/api/meta/pages`.

Direzione del flusso: **prevalentemente in ingresso**. Il webhook riceve la
notifica di un nuovo lead e il CRM richiama
`https://graph.facebook.com/<v>/<leadgen_id>` con i campi
`created_time, id, ad_id, form_id, field_data, custom_disclaimer_responses`.
Da lì arrivano nome, email, telefono e le risposte al form, che diventano una
riga in `leads` con `origine_lead` e `campaign_name`.

In uscita verso Meta: solo il token di accesso e l'identificativo del lead — il
CRM **non** invia a Meta liste di contatti, audience personalizzate o eventi di
conversione. Verificato: nessuna chiamata a Conversions API o Custom Audiences
nel codice.

Il campo `leads.social_lead_id` conserva l'identificativo Meta del contatto.

**DPA: da verificare con Nando.** Da chiarire anche il rapporto di
contitolarità che Meta pone per i Lead Ads.

### Pabbly — ponte fra Meta e il CRM

`LEAD_INTAKE_KEY_PABBLY` è presente in Production ed è la chiave associata
all'origine `meta_ads` in `/api/public/lead-intake`. La presenza della chiave
indica che un flusso Pabbly è (o è stato) configurato per inoltrare i lead.

Dati: gli stessi dati di contatto dei lead Meta, che transitano da Pabbly prima
di arrivare al CRM.

**Da verificare con Nando**: se il flusso Pabbly sia effettivamente attivo
oggi, e se esista un DPA. Dal solo codice si vede la chiave, non il traffico.

---

## Configurati ma non attivi in produzione

### Anthropic — API Claude

`ANTHROPIC_API_KEY` è presente **solo in `.env.local`**, non nell'ambiente
Production di Vercel. La funzione che la usa (`extractScanWithClaude` in
`lib/roberta/knowledge.ts`) esce restituendo `null` quando la chiave manca:
**in produzione la chiamata non avviene.**

Cosa verrebbe inviato se attivata: i PDF dei **listini prezzi** letti da
Nextcloud, in base64, per estrarne il testo commerciale. Sono documenti di
prodotto — prezzi, potenze, garanzie — **nessun dato personale di lead o
clienti**. Il cron `/api/cron/roberta-sync` (ore 02:00) alimenta la base di
conoscenza del chatbot con questo materiale.

**DPA: da verificare con Nando**, se e quando la chiave venga portata in
produzione.

### Twilio — WhatsApp

Sette variabili `TWILIO_*` presenti in `.env.local`, incluso un numero mittente
tedesco (`whatsapp:+49...`). **Nessuna riga di codice nel repository le legge**
(verificato con ricerca su `process.env.TWILIO`), e nessuna di esse è presente
in Production.

Conclusione: nessun dato raggiunge Twilio oggi. Restano credenziali inattive in
un file locale — vedi [stato privacy by design](./privacy-by-design-stato.md),
punto 9.

**DPA: da verificare con Nando** prima di qualsiasi attivazione, considerato
che il campo `consenso_contatto_whatsapp` esiste già ma non è verificato da
nessun percorso.

### Make.com — automazioni

Riga `integrazioni` "Make — Lead da Meta Ads": `attivo: false`,
`config: { scenario_id: "", webhook_url: "" }`. Nessuna variabile `MAKE_*` in
Production. L'unico riferimento nel codice è un token fittizio in
`lib/mock-data.ts`.

Nessun dato raggiunge Make.com oggi.

**DPA: da verificare con Nando** se il servizio venga attivato.

### OpenAPI eSignature — firma elettronica

Riga `integrazioni` "OpenAPI eSignature": `attivo: false`, token vuoto,
endpoint `https://esignature.openapi.com`. Nessun codice lo chiama.

Nessun dato lo raggiunge oggi. Se attivato tratterebbe documenti contrattuali
firmati, quindi dati personali. **DPA: da verificare con Nando.**

### Zoho CRM — sistema di origine

Non è un subprocessor del CRM attuale ma la **fonte** dei dati storici.
`zoho_sync_runs` registra un solo run, il 15/08/2026, in modalità `dry_run`
(nessuna scrittura). Nessun cron di sincronizzazione è configurato: gli unici
strumenti sono script manuali in `scripts/zoho-sync/`.

`zoho_sync_events` conserva 10.034 righe con i payload dell'import, quindi dati
personali dei lead in forma grezza.

**Da verificare con Nando**: se i dati risiedano ancora anche su Zoho, e per
quanto vada conservato `zoho_sync_events`.

---

## Osservazione sulle variabili d'ambiente

Su 28 variabili configurate nel progetto Vercel, **25 sono marcate
"Non-sensitive"**, incluse:

- `SUPABASE_SERVICE_ROLE_KEY` — chiave che ignora ogni policy RLS;
- `NEXTCLOUD_CRED_ENC_KEY` — chiave di cifratura delle app-password Nextcloud;
- `NEXTCLOUD_ADMIN_PASSWORD`, `SMTP_PASSWORD`, `META_APP_SECRET`,
  `META_PAGE_ACCESS_TOKEN`.

"Non-sensitive" su Vercel significa che il valore resta leggibile dalla
dashboard e dal CLI da parte di chiunque abbia accesso al progetto. Solo tre
variabili (`NEXTCLOUD_CLIENT_ID`, `NEXTCLOUD_CLIENT_SECRET`, `NEXTCLOUD_URL`)
sono marcate "Sensitive".

Conseguenza concreta: la chiave che cifra le credenziali Nextcloud è
consultabile con la stessa facilità del dato che protegge. Ripreso in
[stato privacy by design](./privacy-by-design-stato.md), punto 10.

## Riepilogo dei punti da chiarire

1. Esistenza e copertura dei DPA per Vercel, Supabase, Hetzner/Nextcloud, AWS
   SES, Meta e Pabbly — i sei fornitori che trattano dati personali oggi.
2. Chi è la controparte contrattuale per Nextcloud (Hetzner o rivenditore).
3. Se il flusso Pabbly sia attivo.
4. Se l'eventuale contratto Aruba copra qualcosa di diverso dall'invio email
   (che passa da AWS SES).
5. Se e quando Anthropic, Twilio, Make.com e OpenAPI debbano essere attivati —
   e i relativi DPA prima dell'attivazione.
