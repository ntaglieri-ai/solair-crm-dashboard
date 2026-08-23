# Privacy by design: stato reale

**Rilevato il**: 23–24 agosto 2026, sul branch `develop`, sulla configurazione
di produzione e sul database `solair-crm`.

**Cosa contiene**: una checklist puntuale di ciò che è implementato davvero,
messo a confronto con i default non restrittivi e gli accessi più ampi del
necessario rimasti nel codice. **Nessuna modifica apportata.**

Legenda: **✅ implementato** · **⚠️ implementato con riserva** ·
**❌ non implementato** · **❓ da verificare con Nando**

---

## Quadro d'insieme

| # | Voce | Stato |
|---|---|---|
| 1 | RLS attiva sulle tabelle CRM | ⚠️ attiva, ma su 18 tabelle la policy è `using (true)` |
| 2 | Accesso anonimo chiuso | ✅ verificato il 23/08/2026 |
| 3 | Scrittura su tabelle di permessi ristretta | ❌ aperta a ogni autenticato |
| 4 | Registro di audit | ⚠️ funzionante, copertura parziale, leggibile da tutti |
| 5 | Cifratura credenziali Nextcloud ed email | ✅ pgcrypto |
| 6 | Permessi di campo (`permessi_campo`) | ❌ configurati, mai applicati |
| 7 | Permesso di export | ❌ configurato, mai verificato |
| 8 | Consensi di contatto | ❌ raccolti, mai verificati prima dell'invio |
| 9 | Credenziali inattive in giro | ⚠️ Twilio, solo in locale |
| 10 | Gestione dei segreti su Vercel | ⚠️ 25 su 28 marcate "Non-sensitive" |
| 11 | Default dei permessi in assenza di configurazione | ⚠️ permissivi per AGENT |
| 12 | Permessi in assenza di sessione | ⚠️ fail-open, mitigato da due strati |
| 13 | Guardie sugli endpoint API | ✅ copertura completa |
| 14 | Endpoint pubblici | ⚠️ due senza chiave, su dati non personali |
| 15 | Sicurezza della sessione | ⚠️ timeout e blocco IP sì, 2FA no |
| 16 | Conservazione e cancellazione | ❌ nessun meccanismo |
| 17 | Diritti dell'interessato | ❌ nessuno strumento |
| 18 | Minimizzazione della proiezione | ✅ mai `select *` |

---

## 1. RLS ⚠️

RLS è attiva sulle tabelle CRM. Su `leads`, `clienti`, `compiti` e
`installatori` la policy è effettivamente selettiva:

```
has_full_row_visibility()
  OR <tab>_proprietario_id IS NULL
  OR <tab>_proprietario_id = current_utente_id()
```

Su **18 tabelle**, però, la migration `20260820_enable_rls_legacy_crm_tables.sql`
ha creato una policy `crm_authenticated_access` nella forma
`for all to authenticated using (true) with check (true)`: RLS risulta
"attiva" ma non filtra nulla, né in lettura né in scrittura. La migration lo
dichiara apertamente come scelta conservativa, rimandando le policy fini a un
intervento successivo che non è ancora avvenuto (tranne che per `crm_settings`,
vedi punto 3).

Ricaduta pratica sul ramo `IS NULL`: **15 clienti su 16 e 33 lead non hanno
proprietario**, quindi sono leggibili da ogni utente autenticato. Per la
tabella clienti la restrizione per proprietario, di fatto, non restringe.
Dettaglio in [minimizzazione dati in UI](./minimizzazione-dati-ui.md), G6.

## 2. Accesso anonimo ✅

**Chiuso, verificato.** Il 23/08/2026 sono state interrogate 15 tabelle via
PostgREST con la sola chiave anon e nessuna sessione: `leads`, `clienti`,
`compiti`, `installatori`, `utenti`, `audit_log`, `scadenze`, `attivita`,
`crm_settings`, `ruoli`, `permessi_campo`, `tag`, `bacheca_messaggi`,
`documenti` restituiscono **0 righe**; `nextcloud_credentials` non è nemmeno
esposta allo schema API (HTTP 400).

La migration `20260822_restrict_crm_policies_to_authenticated.sql` risulta
quindi applicata. La falla documentata in precedenza (clienti 15/16, leads 33
leggibili senza sessione) **non è più riproducibile**.

## 3. Scrittura sulle tabelle di permessi ❌

**Il punto più serio del documento.**

Fra le 18 tabelle con policy `using (true) with check (true)` ci sono:

- `permessi_record` (175 righe) — chi può vedere, creare, modificare,
  cancellare ed esportare, per ruolo e modulo;
- `permessi_pagina` (65 righe);
- `permessi_azione` (5 righe);
- `ruoli` (5 righe).

La policy concede `for all` — quindi anche `UPDATE` e `INSERT` — a **qualunque
utente autenticato**. Un utente con ruolo AGENT, usando la chiave anon
pubblicata nel bundle del browser insieme al proprio token di sessione, può
scrivere direttamente su PostgREST e concedersi qualunque permesso, senza
passare dall'applicazione.

La stessa esposizione su `crm_settings` è stata chiusa il 23/08/2026
(`20260823_crm_settings_write_policies.sql`, commit d717d2e). Le tabelle dei
permessi sono rimaste fuori da quell'intervento: nessuna migration successiva
le tocca.

> **Da confermare prima di intervenire.** Questa conclusione deriva dalla
> lettura delle migration e dalla verifica che nessuna migration successiva le
> modifichi. Non è stata riprodotta con una sessione reale, perché farlo
> avrebbe richiesto di creare una sessione utente — fuori dal perimetro di
> stanotte. Va confermata con una query su `pg_policies` filtrata sulle quattro
> tabelle. Se confermata, è la prima cosa da chiudere.

## 4. Registro di audit ⚠️

**Funziona.** `logAudit` scrive con `service_role` (nessuna policy di INSERT
esiste, quindi la scrittura non dipende dai permessi di chi genera l'evento —
scelta corretta) e non può far fallire l'operazione registrata: ogni errore è
catturato e finisce solo su console.

Tre riserve:

- **Copertura parziale.** Scrivono nell'audit: login, modifica/eliminazione di
  lead e clienti, gestione utenti e permessi, impostazioni di sessione, blocco
  IP, e — da oggi — gli export CSV. **Non** scrivono: compiti, scadenze,
  installatori, documenti, allegati, invii email di massa.
- **Volume.** 5 righe totali al 23/08/2026, tutte dello stesso giorno. Il
  registro è appena entrato in funzione: non esiste storico anteriore.
- **Leggibile da chiunque sia autenticato** (unica policy: `audit_log_select`).
  La pagina è riservata a SUPERADMIN, ma la restrizione è nell'interfaccia, non
  nei dati. Il registro contiene indirizzi IP e frammenti di record.

## 5. Cifratura delle credenziali ✅

Le app-password Nextcloud (`nextcloud_credentials.app_password_enc`, 3 righe) e
le credenziali email personali (`email_credentials_personali`, 0 righe) sono
cifrate con `pgp_sym_encrypt` (pgcrypto), chiave simmetrica in
`NEXTCLOUD_CRED_ENC_KEY`. Cifratura e decifratura passano da RPC dedicate; la
tabella non è esposta allo schema API.

Verificato inoltre che `utenti.nextcloud_access_token` e
`nextcloud_refresh_token` — colonne residue del vecchio flusso OAuth, che
avrebbero contenuto token in chiaro — sono **vuote su tutte e 30 le righe**. Il
codice che le scriveva è stato rimosso; le colonne sono rimaste. Andrebbero
eliminate: una colonna vuota che nessuno usa è, prima o poi, una colonna che
qualcuno riempie.

Riserva sulla chiave: vedi punto 10.

## 6. Permessi di campo ❌

`permessi_campo` contiene 179 righe di configurazione. Le funzioni che la
leggono (`canField`, `fieldAccess`) **non sono chiamate da nessun punto del
codice**. La configurazione è inerte: impostare un campo su "nascosto" non
nasconde niente.

È la voce con il divario più ampio fra intenzione dichiarata e comportamento.
Analisi completa in [minimizzazione dati in UI](./minimizzazione-dati-ui.md),
G1–G3 e G7.

## 7. Permesso di export ❌

L'azione `export` esiste in `permessi_record` ed è configurata (STANDARD e
AGENT non ce l'hanno su lead e clienti), ma **nessun punto del codice la
verifica**. Gli endpoint di export introdotti oggi controllano `view`,
coerentemente con il resto del codice — quindi due ruoli possono esportare pur
non avendone il permesso. Dettaglio in G5.

## 8. Consensi di contatto ❌

I tre campi `consenso_contatto_telefono`, `consenso_contatto_whatsapp`,
`consenso_contatto_email` vengono **scritti** all'ingresso del lead
(`lib/leads/public-intake.ts`) e poi usati **solo per alzare di 5 punti il
punteggio del lead** (`intakeScore`).

Nessun percorso di invio li legge: né l'invio singolo, né l'invio di massa, né
la composizione email. Ricerca su `app/api/email-massa/`, `lib/email/` e
`components/shared/bulk-email-dialog.tsx`: zero occorrenze di `consenso`.

Stato dei dati: **3 lead su 9.365 hanno `consenso_contatto_email = true`**, 0
sono `null`, quindi ~9.360 sono a `false`. Un invio massivo su un filtro largo
raggiunge oggi anche loro.

Questa è una constatazione tecnica: la base giuridica dell'invio può essere
diversa dal consenso e non è una valutazione che spetti a questo documento.
Ma il campo esiste, è popolato, e non è consultato — quindi non sta
proteggendo nulla.

## 9. Credenziali inattive ⚠️

Sette variabili `TWILIO_*` (compreso un numero WhatsApp mittente) sono in
`.env.local`. Nessuna riga di codice le legge e nessuna è presente in
produzione: sono credenziali attive verso un servizio esterno, ferme in un file
locale, senza alcun uso.

Analogamente, le righe `integrazioni` per Make.com e OpenAPI eSignature esistono
disattivate con configurazione vuota.

## 10. Gestione dei segreti su Vercel ⚠️

Su 28 variabili del progetto, **25 sono marcate "Non-sensitive"** — quindi con
valore leggibile dalla dashboard e dal CLI da chiunque abbia accesso al
progetto. Fra queste:

- `SUPABASE_SERVICE_ROLE_KEY` — ignora ogni policy RLS;
- `NEXTCLOUD_CRED_ENC_KEY` — **la chiave che cifra le app-password del punto 5**;
- `NEXTCLOUD_ADMIN_PASSWORD`, `SMTP_PASSWORD`, `META_APP_SECRET`,
  `META_PAGE_ACCESS_TOKEN`.

Solo `NEXTCLOUD_CLIENT_ID`, `NEXTCLOUD_CLIENT_SECRET` e `NEXTCLOUD_URL` sono
"Sensitive" — e sono, fra tutte, le tre meno critiche.

L'effetto sul punto 5 va detto per esteso: la cifratura delle credenziali
Nextcloud protegge dal furto del solo database, non da chi ha accesso al
progetto Vercel, perché lì la chiave è leggibile accanto al dato che protegge.

## 11. Default dei permessi ⚠️

In `buildDefaultPermissionSnapshot` (`lib/permissions/constants.ts`), quando un
modulo non ha righe in `permessi_campo` si applica un default per ruolo:

| Ruolo | Default campi |
|---|---|
| SUPERADMIN | `{ "*": "editable" }` |
| ADMIN | `{ "*": "editable" }` |
| **AGENT** | **`{ "*": "editable" }`** |
| DIRECTOR | `{ "*": "readonly" }` |
| STANDARD (fallback) | `{ "*": "readonly" }` |

AGENT — il ruolo meno privilegiato — riceve il default **più permissivo**,
mentre DIRECTOR e STANDARD, che stanno sopra di lui, ricevono `readonly`. Non
c'è nel codice un commento che spieghi la scelta; sembra una svista.

Oggi l'effetto è nullo perché il punto 6 rende inerte l'intero meccanismo. Ma
nel momento in cui `permessi_campo` venisse applicato, questo default
diventerebbe attivo — e AGENT si troverebbe modificabile ogni campo di ogni
modulo non esplicitamente configurato. **Va corretto insieme al punto 6, non
dopo.**

Nota positiva sul motore: `fieldAccess` in `engine.ts` ricade su `"hidden"`
quando non trova né il campo né `"*"`. Il default del motore è restrittivo; è
lo snapshot costruito sopra che lo scavalca.

## 12. Permessi in assenza di sessione ⚠️

In `lib/permissions/load-permissions.ts:306-311`, quando non c'è un utente
autenticato, la funzione restituisce:

```ts
buildDefaultPermissionSnapshot({ ruoloCode: "STANDARD", ruoloNome: "Non autenticato" })
```

Cioè una richiesta senza sessione riceve **il set di permessi di STANDARD**:
`view/create/edit` su lead, clienti, compiti e scadenze. Le guardie API
(`requireApiRecord`) interrogano questo snapshot, quindi in isolamento
passerebbero.

**Non è oggi sfruttabile**, grazie a due strati indipendenti:

1. il middleware intercetta ogni richiesta non pubblica senza sessione e
   reindirizza a `/login` — il matcher copre anche `/api` (verificato);
2. RLS blocca comunque l'accesso anonimo ai dati (punto 2).

Resta un default che dice "sì" quando non sa chi ha di fronte. Il valore
corretto sarebbe un set vuoto. È una correzione di poche righe, ma tocca il
percorso di autenticazione: fuori dal perimetro di stanotte, da fare a mente
fresca e con una prova esplicita.

## 13. Guardie sugli endpoint API ✅

Copertura verificata modulo per modulo: leads 10/10, clienti 8/8, compiti 4/4,
scadenze 4/4, documenti 2/2, allegati 4/4, bacheca 2/2, search 1/1.

I tre file che non usano `requireApi*` sono stati letti: tutti applicano un
controllo equivalente o più stretto —
`installatori/suggeriti` chiama direttamente `canRecord`;
`email-massa/[jobId]/status` verifica la proprietà del job;
`profilo` opera solo sull'utente della sessione corrente.

Nessuna lacuna trovata su questo fronte.

## 14. Endpoint pubblici ⚠️

Otto route sotto `/api/public`, esenti dal middleware per costruzione.

Protette da API key statica in `Authorization: Bearer`: `lead-intake` (chiave
diversa per ciascuna origine), `listino`, `offerte-periodo`,
`roberta-knowledge`, `calculate-quote`.

**Senza alcuna chiave**: `catalogo` e `discount-code`. Entrambe usano
`createAdminClient()`, quindi girano con `service_role` e ignorano RLS. I dati
esposti sono il catalogo prodotti e i codici sconto — **commerciali, non
personali**: l'esposizione è di listino, non di dati di persone. Va comunque
saputo che sono due endpoint aperti che parlano al database con i privilegi più
alti disponibili.

`asset` è aperto ma limitato per costruzione ai prefissi
`Solair/Offerta-Commerciale/{Pannelli,Batterie}/`, con blocco esplicito di
`..`: serve immagini di prodotto e non può raggiungere le cartelle dei record.

## 15. Sicurezza della sessione ⚠️

Configurazione reale in `crm_settings`:

| Impostazione | Valore |
|---|---|
| `session_timeout_minutes` | 120 |
| `max_login_attempts` | 5 |
| `ip_block_enabled` | `true` |
| `2fa_enabled` | **`false`** |

Il 2FA è previsto dall'impostazione ma disattivato. Considerato che il CRM
contiene documenti d'identità e IBAN, e che i segreti di produzione sono
leggibili da chi ha accesso al progetto Vercel (punto 10), vale la pena
decidere se attivarlo. **❓ da verificare con Nando** se sia una scelta o un
residuo.

Nota positiva: 0 utenti su 30 hanno ancora la password temporanea
(`must_change_password`), e il gate che li bloccherebbe è attivo nel middleware.

## 16. Conservazione e cancellazione ❌

Nessun meccanismo di conservazione esiste nel codice: nessuna cancellazione
programmata, nessun campo di scadenza, nessun job di pulizia. Tutti i 9.365
lead — compresi quelli importati da Zoho e mai lavorati — restano a tempo
indeterminato.

Da segnalare in particolare `zoho_sync_events`: **10.034 righe** contenenti i
payload grezzi dell'import, quindi una seconda copia dei dati personali dei
lead in forma non normalizzata. L'import è concluso (ultimo run 15/08/2026, in
`dry_run`). **❓ da verificare con Nando** se vada conservato.

## 17. Diritti dell'interessato ❌

Non esiste alcuno strumento per:

- estrarre tutti i dati di un singolo interessato (l'export CSV è per elenco
  filtrato, non per persona, e non tocca gli allegati su Nextcloud);
- cancellare un interessato in modo completo — la cancellazione di un lead o
  cliente **non propaga** alla sua cartella Nextcloud, né a `zoho_sync_events`,
  né alle righe di `attivita` e `compiti` che lo nominano;
- registrare la revoca di un consenso in modo che abbia effetto (punto 8).

## 18. Minimizzazione della proiezione ✅

Le query non usano mai `select *`: entrambi i repository dichiarano una lista
esplicita di colonne (`LIST_COLUMNS` per la lista, `DETAIL_COLUMNS` per il
dettaglio) e il commento nel codice lo pone come regola. La lista clienti
proietta 15 colonne su oltre 150 disponibili.

È un buon punto di partenza per il punto 6: la proiezione per lista esiste già,
manca il filtro per ruolo sopra di essa.

---

## Se domani si può fare una cosa sola

**Il punto 3**: confermare con `pg_policies` se `permessi_record`,
`permessi_pagina`, `permessi_azione` e `ruoli` siano davvero scrivibili da ogni
utente autenticato e, se sì, chiuderle come è già stato fatto per
`crm_settings`. Tutti gli altri controlli descritti in questi documenti
poggiano su quelle quattro tabelle: finché sono scrivibili da chiunque, ogni
permesso configurato sopra è un'indicazione, non un vincolo.

A seguire, in ordine: punto 6 con il punto 11 (insieme, mai separati), punto 1
sul ramo `IS NULL`, punto 8.
