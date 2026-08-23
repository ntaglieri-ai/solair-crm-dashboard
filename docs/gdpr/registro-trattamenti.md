# Registro tecnico dei trattamenti

**Ambito**: CRM Solair (`solair-crm-dashboard`).
**Rilevato il**: 23 agosto 2026, sul database di produzione (`solair-crm`, ref
`ayyazgtqsocwvucbvega`) e sul codice del branch `develop`.
**Natura del documento**: ricognizione tecnica. Descrive quali dati esistono
davvero, dove stanno e chi può raggiungerli. **Non è una valutazione legale** e
non stabilisce basi giuridiche, tempi di conservazione o adeguatezza: quelle
vanno decise con chi segue la parte legale, usando questo testo come base di
fatto.

## Come sono stati raccolti i dati di questo documento

- Colonne: lette dallo schema reale via PostgREST (nomi di colonna, mai valori).
- Conteggi: aggregati `count=exact`, nessuna riga estratta.
- Ruoli e permessi: tabelle `ruoli`, `permessi_record`, `permessi_campo`.
- Residenza: `supabase projects list` (regione del progetto) e `vercel.json`.

Dove un'informazione non è verificabile dal codice o dal database è scritto
**"da verificare con Nando"** invece di essere dedotta.

## 1. Dove risiedono fisicamente i dati

| Sistema | Contenuto | Regione | Verificato come |
|---|---|---|---|
| Supabase Postgres (`solair-crm`) | tutte le tabelle applicative | `eu-central-1` — **Francoforte, Germania** | `supabase projects list` |
| Supabase Auth (`auth.users`) | identità di login dei 30 utenti interni | stesso progetto, Francoforte | idem |
| Vercel Functions | esecuzione applicativa, nessuna persistenza | `fra1` — **Francoforte** | `vercel.json` → `"regions": ["fra1"]` |
| Nextcloud (`nx101824.your-storageshare.de`) | allegati di Lead/Clienti/Installatori, listini | Hetzner Storage Share — **Germania** | `NEXTCLOUD_URL`, riga `integrazioni` attiva |
| AWS SES (`email-smtp.eu-west-1.amazonaws.com`) | transito delle email in uscita | `eu-west-1` — **Irlanda** | `SMTP_HOST` in produzione |

Nota: il canale email **non è Aruba** ma Amazon SES in Irlanda. Vedi
[mappa fornitori](./fornitori-subprocessor.md).

## 2. Ruoli definiti

Cinque ruoli in `ruoli` (30 utenti totali, 30 attivi al 23/08/2026):

`SUPERADMIN` (Superadmin) · `ADMIN` (Amministratore) · `DIRECTOR` (Direttore) ·
`STANDARD` (Commerciale standard) · `AGENT` (Agente).

Matrice `permessi_record` come configurata in produzione
(v=view, c=create, e=edit, d=delete, x=export):

| Modulo | SUPERADMIN | ADMIN | DIRECTOR | STANDARD | AGENT |
|---|---|---|---|---|---|
| lead | tutto | v c e d x | v c e d x | v c e | v c e |
| clienti | tutto | v c e d x | v c e d x | v c e | v |
| compiti | tutto | v c e d x | v c e d | v c e d | v c e |
| scadenze | tutto | v c e d x | — | — | — |
| installatori | tutto | v c e d x | — | — | — |
| documenti | tutto | v c e d x | v c e d | v c e | v |
| fatture | tutto | v c e d x | — | — | — |

> **Avvertenza sull'uso di questa tabella.** È la configurazione, non
> necessariamente il comportamento. L'azione `export` non è verificata da
> nessun punto del codice, e i permessi di campo non sono applicati affatto:
> vedi [minimizzazione dati in UI](./minimizzazione-dati-ui.md). La tabella
> descrive l'intenzione dichiarata; le deviazioni reali sono in quel documento.

## 3. Tabelle e dati personali

### 3.1 Tabelle con dati di interessati esterni (persone non dipendenti)

#### `leads` — 9.365 righe

Dati personali: `nome`, `cognome`, `nome_lead`, `email`, `telefono`,
`mobile_fisso`, `citta`, `provincia`, `codice_postale`, `paese`,
`residente_in_sicilia`, `social_lead_id` (identificativo Meta), `descrizione`
(testo libero, può contenere qualunque cosa il contatto abbia scritto).

Dati di profilazione: `valutazione` (punteggio 0–100 calcolato all'ingresso),
`stato_lead`, `stato_email`, `campaign_name`, `origine_lead`, `data_click`.

Dati tecnico-commerciali: `kwp`, `kwh`, `modello_pannello`,
`wallbox_richiesto`, `data_sopralluogo`.

Consensi: `consenso_contatto_telefono`, `consenso_contatto_whatsapp`,
`consenso_contatto_email`. Stato reale: **3 righe con consenso email a `true`,
0 a `null`** — le restanti ~9.360 sono `false`.

Finalità: gestione del contatto commerciale prima della conversione in cliente.

Origine: import storico da Zoho CRM (ultimo run 15/08/2026, in `dry_run`) e
acquisizione continua da `/api/public/lead-intake` (chatbot, configuratore,
Meta Ads via Pabbly, inserimento manuale).

Chi vi accede: SUPERADMIN, ADMIN, DIRECTOR, STANDARD, AGENT — tutti i ruoli.
Il filtro per riga è a livello database (RLS), nella forma
`has_full_row_visibility() OR lead_proprietario_id IS NULL OR lead_proprietario_id = current_utente_id()`.
**33 lead non hanno proprietario** e sono quindi leggibili da ogni utente
autenticato indipendentemente dal ruolo.

#### `clienti` — 16 righe

Dati identificativi: `nome`, `cognome`, `nome_clienti`, `email`, `cellulare`,
`codice_fiscale` (**5 righe valorizzate**), `via_indirizzo_postale`,
`citta_indirizzo_postale`, `provincia_indirizzo_postale`,
`codice_postale_indirizzo`.

Dati bancari e finanziari: `iban` (**5 righe valorizzate**),
`importo_contrattuale`, `saldo`, `n_1_tranche`, `n_2tranche`,
`bonifico_parziale`, `bonifico1`, `bonifico2`, `bonificopdc`,
`importo_finanziamento`, `finanziamento_approvato`, `modalita_di_pagamento`,
`n_rate_e_importo_rata`, `fattura1`, `fattura2`, `fatturapdc`,
`corrispettivo_pagato`, `tot_contratto`, `data_fatt_pagamento`.

Dati su immobile e utenza (riferibili alla persona): `pod`,
`nome_intestatario_utenza_elettrica`, `cognome_intestatario_utenza_elettrica`,
`e_mail_enel_gaudi`, `foglio`, `particella`, `sub`, `mappa_catastale`,
`titolarita_impianto`, `tipologia_proprietario`, `area_vincolata`,
`indirizzo_di_ritiro_merce`.

Dati di pratica: `codice_contratto_pnrr`, `tica`, `stato_tica`,
`attestato_terna`, `regolamento_di_esecizio`, `scheda_enea`,
`inserimento_pratica_gse`.

Finalità: esecuzione del contratto di fornitura e installazione, gestione
pratiche GSE/Enel/Terna, fatturazione e incasso.

Chi vi accede: tutti i ruoli hanno almeno `view`. **15 clienti su 16 non hanno
`clienti_proprietario_id`**, quindi il ramo `IS NULL` della policy RLS li rende
leggibili da ogni utente autenticato — di fatto la quasi totalità della tabella
è visibile a chiunque abbia un account, AGENT compreso.

#### `installatori` — 16 righe

Dati: `nome`, `email`, `email_secondaria`, `telefono`, `note` (testo libero),
`canale_preferito`, zone di competenza in `installatore_zone` (55 righe) e
`installatore_zone_raggio`.

Natura: persone fisiche o ditte individuali fornitrici. Finalità: assegnazione
sopralluoghi e installazioni, contatto operativo.

Chi vi accede: solo SUPERADMIN e ADMIN hanno permessi di record configurati.

### 3.2 Tabelle con dati di utenti interni

#### `utenti` — 30 righe

Dati: `nome`, `email`, `ruolo` / `ruolo_id`, `sede`, `attivo`, `auth_user_id`
(collegamento a `auth.users`), `zoho_id`, `must_change_password`,
`welcome_email_status`, `welcome_email_error`.

Sono presenti anche `nextcloud_access_token`, `nextcloud_refresh_token`,
`nextcloud_token_expires_at`: **colonne residue del vecchio flusso OAuth,
verificate vuote (0 righe valorizzate su 30)**. Il codice che le scriveva è
stato rimosso; le colonne no.

Finalità: autenticazione, autorizzazione, attribuzione dei record.

#### `nextcloud_credentials` — 3 righe

`utente_id`, `nc_username`, `app_password_enc`, `status`, `last_error`.
La app-password è cifrata con pgcrypto (`pgp_sym_encrypt`), chiave simmetrica
in `NEXTCLOUD_CRED_ENC_KEY`. La tabella non è raggiungibile via PostgREST
(HTTP 400 anche con service_role: non esposta allo schema API).

#### `email_credentials_personali` — 0 righe

Stessa struttura cifrata di `nextcloud_credentials`, per le credenziali SMTP
personali usate nell'invio verso i lead. Attualmente vuota.

#### `audit_log` — 5 righe

`utente_id`, `utente_nome` (istantanea, sopravvive alla cancellazione
dell'utente), `tipo_evento`, `modulo`, `record_id`, `descrizione`,
`dati_prima`, `dati_dopo`, `ip_address`, `user_agent`, `esito`, `created_at`.

Contiene **l'indirizzo IP dell'utente interno** che compie l'operazione, e nei
campi `dati_prima`/`dati_dopo` frammenti dei record modificati — quindi
potenzialmente dati personali di lead e clienti.

Finalità: tracciabilità delle operazioni sul CRM.

Stato reale: 5 righe, tutte del 23/08/2026 (2 `accesso`, 3 `operazione_admin`).
Il registro è appena entrato in funzione; non contiene storico. Da oggi
registra anche gli export CSV (`export_dati`) — in quel caso `dati_dopo`
contiene solo i conteggi e i filtri dell'estrazione, mai le righe estratte.

Scrittura: esclusivamente con `service_role`; non esiste alcuna policy di
INSERT. Lettura: consentita a qualunque utente autenticato.

#### `attivita` — 9 righe

`tipo`, `testo`, `campo`, `valore_precedente`, `valore_nuovo`,
`email_aperture_count`, `email_ultima_apertura`, `record_id`, `record_tipo`,
`utente_id`. Include il tracciamento delle aperture email dei destinatari.

### 3.3 Tabelle operative che referenziano persone

| Tabella | Righe | Dati personali contenuti | Finalità |
|---|---|---|---|
| `compiti` | 2.346 | `nome_contatto`, `descrizione`, `proprietario_nome`, `creato_da_nome`, `modificato_da_nome` | attività commerciali e operative |
| `scadenze` | 8 | `nome`, `descrizione`, `proprietario_nome` | promemoria su lead/clienti |
| `lead_tags` | 4.397 | nessun dato diretto — classificazione dei lead | segmentazione |
| `cliente_tags` | 66 | idem su clienti | segmentazione |
| `installatore_tags` | 10 | idem su installatori | segmentazione |
| `documenti` | 0 | metadati allegati (nome file, percorso Nextcloud) | indice allegati |
| `collegamenti` | 0 | relazioni fra record | navigazione |
| `bacheca_messaggi` | 0 | autore e testo dei messaggi interni | comunicazioni interne |
| `email_massa_jobs` | 0 | destinatari e stato di un invio massivo | invii massivi |

### 3.4 Tabelle di configurazione e supporto (nessun dato personale di esterni)

`ruoli`, `permessi_record` (175), `permessi_campo` (179), `permessi_pagina`
(65), `permessi_azione` (5), `permessi_ui` (75), `permessi_speciali` (77),
`permessi_scope`, `permessi_cartelle_nextcloud` (90), `crm_settings` (12
chiavi), `tag` (90), `ip_bloccati` (0), `lookup_values`, `crm_custom_fields`,
`crm_column_values`, `attributi_record`, `cartelle_preferite`, `integrazioni`
(3), `listino_cache` (27), `catalogo_prodotti`, `roberta_*` (fonti e chunk di
conoscenza commerciale), `offerta_commerciale_*` (cataloghi, offerte,
documenti), `zoho_sync_runs` / `zoho_sync_events` (10.034) /
`zoho_sync_conflicts`, `zoho_user_staging` (63).

Due precisazioni:

- `ip_bloccati` conterrà indirizzi IP quando popolata (oggi 0 righe).
- `zoho_sync_events` (10.034 righe) è il registro dell'import: **contiene i
  payload dei record importati**, quindi dati personali di lead. Da verificare
  con Nando se debba essere conservato ora che l'import è concluso.

### 3.5 Tabelle presenti nel database ma inutilizzate

`regole_assegnazione` (0 righe), `workflow_rules` (0), `custom_fields` (0),
`custom_field_values` (0), `cliente_impianto`, `cliente_pagamenti`,
`cliente_logistica`, `cliente_comunicazioni`, `cliente_iter_burocratico`,
`cliente_documenti_stato`, `compito_tags` — tutte a 0 righe. Sono strutture
create e mai riempite; nessun trattamento in corso su di esse.

## 4. Dati fuori dal database

### Nextcloud (Hetzner, Germania)

Struttura degli allegati, radice `Solair/Vendita-Digitale`:

- `Preventivi progetto 2.0/` — cartella per lead, contenente la sottocartella
  "documenti obbligatori" (documento d'identità, bolletta, visura: **documenti
  di identificazione**);
- `Clienti 2.0/` — cartella per cliente, documentazione contrattuale e di
  pratica;
- `INSTALLATORI/` — documentazione fornitori;
- `Solair/Offerta-Commerciale/{Pannelli,Batterie}/` — immagini prodotto, senza
  dati personali, esposte pubblicamente da `/api/public/asset`.

Le cartelle sono create automaticamente alla creazione di un lead. Il percorso
è deterministico (id record + nome), quindi non è archiviato in database.

Nota sul controllo accessi: le ACL native di Nextcloud **non riflettono** le
regole di `permessi_cartelle_nextcloud` — il filtro per percorso è applicato
dall'applicazione, non dallo storage. Un utente provisionato vede solo la
propria home; le cartelle aziendali sono raggiungibili dagli account
amministrativi.

### Supabase Auth

`auth.users` contiene email e credenziali dei 30 utenti interni, più i metadati
di sessione. Nessun interessato esterno ha un account.

## 5. Flussi di dati verso l'esterno

Elencati e verificati in [mappa fornitori](./fornitori-subprocessor.md).
In sintesi: ingresso lead da Meta Ads; uscita email verso i lead/clienti via
AWS SES; allegati verso Nextcloud/Hetzner; nessun altro flusso di dati
personali attivo in produzione al 23/08/2026.

## 6. Punti da chiarire (non deducibili dal codice)

- Tempi di conservazione: nessuna cancellazione automatica esiste nel codice.
  Nessuna tabella ha una retention policy. **Da verificare con Nando.**
- Base giuridica per i ~9.360 lead con `consenso_contatto_email = false`.
  **Da verificare con Nando.**
- Sorte di `zoho_sync_events` (10.034 payload di import). **Da verificare con Nando.**
- Se i dati Zoho originali siano ancora presenti su Zoho oltre che qui.
  **Da verificare con Nando.**
- Procedura di risposta a richieste di accesso/cancellazione: non esiste nel
  prodotto (nessun export per interessato, nessuna cancellazione a cascata su
  Nextcloud). **Da verificare con Nando.**
