# Piano operativo manutenzione CRM, sito e integrazioni

Stato: bozza operativa.

Canale alert tecnico: `TODO_ALERT_EMAIL`

Obiettivo: definire un presidio chiaro per CRM, sito, infrastruttura, integrazioni e bot. Il canale alert raccoglie gli errori tecnici; le attivita preventive restano in checklist/report. Non tutto deve produrre alert.

## Ruoli

| Ruolo | Responsabilita |
|---|---|
| Manutentore tecnico | Configura alert, controlla checklist, fa triage, corregge piccoli problemi, apre/esegue interventi correttivi. |
| Cliente/admin Solair | Fornisce accessi, autorizza cambi critici, conferma rinnovi/licenze, segnala problemi utente. |
| Provider esterni | Erogano servizio e dashboard: Aruba, Vercel, Supabase, Nextcloud/Hetzner, Make, Meta, AWS SES, Carbone, OpenAPI, OpenAI/Anthropic. |

## Canali

| Canale | Uso | Cosa non deve contenere |
|---|---|---|
| `TODO_ALERT_EMAIL` | Errori tecnici che richiedono triage: down, failed job, webhook rotto, sync fallita, security alert. | Supporto utenti ordinario, esiti backup ordinari, audit qualita dati, reminder amministrativi generici. |
| Supporto utenti esistente | Richieste utenti, dubbi operativi, segnalazioni funzionali. | Alert tecnici automatici. |
| Registro manutenzione | Esiti dei controlli periodici, anomalie, interventi fatti, decisioni aperte. | Segreti, password, token in chiaro. |
| Registro asset/accessi/scadenze | Elenco account, owner, scadenze, rotazioni token/password/API key. | Log tecnici rumorosi. |

## Flusso operativo

1. Alert tecnico arriva su `TODO_ALERT_EMAIL`.
2. Manutentore tecnico fa triage: falso positivo, warning, errore bloccante, errore ricorrente.
3. Se risolvibile entro manutenzione ordinaria: interviene e annota esito nel registro.
4. Se richiede accesso, consenso, costo o modifica rilevante: chiede approvazione al cliente/admin.
5. Se e' sviluppo evolutivo o bug non incluso: apre intervento separato.
6. Nel report periodico si riepilogano alert rilevanti, fix, rischi e azioni aperte.

## Matrice operativa

| # | Ambito | Frequenza | Canale alert | Chi fa cosa | Output |
|---|---|---|---|---|---|
| 1 | Monitoraggio infrastruttura | Alert realtime + check settimanale | Si | Provider inviano alert. Manutentore verifica sito, CRM, Nextcloud, deploy Vercel, stato Supabase/Nextcloud. | Stato sintetico servizi e anomalie risolte/aperta. |
| 2 | Backup | Check settimanale | No | Manutentore verifica ultimo backup Supabase valido e ultimo snapshot Nextcloud/Hetzner valido. Cliente autorizza eventuali upgrade retention/PITR. | Riga nel registro: data ultimo backup/snapshot e risultato. |
| 3 | Integrazioni esterne | Alert realtime + check settimanale | Si | Provider inviano failure. Manutentore controlla Make, SES, Aruba DNS, Meta webhook, Carbone, OpenAPI, CRM-Configuratore, CRM-Nextcloud, CRM-Roberta. | Elenco integrazioni ok/ko, fix o escalation. |
| 4 | Sicurezza | Alert security + check mensile | Si solo security alert | GitHub/Dependabot invia security alert. Manutentore esegue query RLS mensile e valuta vulnerabilita. Cliente autorizza update rischiosi. | Esito sicurezza mensile e azioni richieste. |
| 5 | Audit qualita dati | Check mensile | No | Manutentore esegue query fisse Supabase su enum/campi categorici, owner nulli, record anomali. Cliente valida eventuali correzioni massive. | Anomalie dati e proposta correzione. |
| 6 | Asset, accessi, scadenze, token | Check mensile | No | Manutentore mantiene registro domini, DNS, hosting, API key, token OAuth, account tecnici, password/app-password, SMTP/SES, Meta, Make, OpenAI/Anthropic, Aruba, Vercel, Supabase, Nextcloud. Cliente conferma owner e rinnovi. | Registro aggiornato e scadenze prossime. |
| 7 | Aggiornamenti dipendenze | Check mensile + alert security | Parziale | Dependabot/Renovate possono aprire PR. Manutentore valuta update security subito e update ordinari nel giro mensile. Cliente approva cambi a rischio. | PR gestite, rinviate o escluse con motivo. |
| 8 | Bug fix / ad-hoc | Su trigger | Non e' un canale, e' un workflow | Alert o segnalazione utente genera triage. Manutentore lavora su develop, testa, porta a main/deploy secondo workflow. Cliente approva se impatto/costo extra. | Fix, note test, deploy o stima extra. |
| 9 | Supporto utenti/helpdesk | On demand | No | Utenti scrivono su canale supporto esistente. Manutentore risponde/filtra. Cliente aiuta su priorita e policy interne. | Volume richieste e casi ricorrenti nel report. |
| 10 | Documentazione | On demand | No | Manutentore aggiorna runbook, note accessi, procedure, Markdown repo o pagina Nextcloud quando cambia qualcosa. Cliente conferma procedure operative. | Documentazione aggiornata. |
| 11 | Bot supervision & maintenance | Alert errori + check settimanale | Si solo errori | Manutentore controlla uso/costi token, log tool, `crea_lead`, `richiedi_contatto_umano`, hit rate cache/listino. Errori applicativi vanno su canale alert. | Stato bot, anomalie, costi/uso e azioni. |

## Setup canale alert

1. Creare alias/casella Aruba, preferibilmente `crm-alerts@dominio.it` o `ops@dominio.it`.
2. Usare alias/inoltro se disponibile, cosi si possono aggiungere destinatari senza cambiare le integrazioni.
3. Sostituire `TODO_ALERT_EMAIL` in questo documento e nelle configurazioni provider.
4. Collegare le sorgenti in ordine:
   - UptimeRobot;
   - Vercel deploy/error alerts;
   - Make scenario failed;
   - GitHub/Dependabot security alerts;
   - AWS SES/CloudWatch reputation e bounce;
   - Meta webhook/app alerts;
   - Carbone;
   - OpenAPI e-Signatures;
   - alert applicativi CRM quando implementati.
5. Mandare un test per ogni sorgente.

## Requisiti codice CRM

I provider esterni inviano direttamente a `TODO_ALERT_EMAIL`: per questi non serve codice CRM.

Serve codice solo per gli errori generati dentro il CRM che oggi restano nei log Vercel tramite `console.error`.

Variabili ambiente proposte:

| Variabile | Scopo |
|---|---|
| `OPS_ALERT_EMAIL_TO` | Destinatario unico alert, es. `crm-alerts@dominio.it`. |
| `OPS_ALERTS_ENABLED` | `true`/`false`, default `false` in locale. |
| `OPS_ALERT_MIN_SEVERITY` | Soglia minima, es. `warning` o `error`. |

L'invio puo riusare SMTP di sistema: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

Helper suggerito: `lib/ops/alerts.ts`.

```ts
notifyOpsAlert({
  source: "crm-nextcloud",
  severity: "error",
  title: "Upload allegato fallito",
  message: errorMessage,
  metadata: { route, recordId, path },
})
```

Regole codice:

- best-effort: un alert fallito non rompe la request utente;
- niente segreti nei metadata;
- niente alert su validazioni utente, 400/403 ordinari o input sbagliati;
- continuare a scrivere `console.error` per log completo Vercel;
- collegare solo failure operative e integrazioni critiche.

Punti CRM prioritari:

| Area | File indicativi | Quando notificare |
|---|---|---|
| Meta webhook | `app/api/meta/webhook/route.ts` | Lead non importabile, token/config non valida, errore Graph/API. |
| Configuratore / lead intake | `app/api/public/lead-intake/route.ts` | Config mancante, insert lead fallita, creazione cartella critica fallita. |
| Nextcloud allegati | `app/api/allegati/route.ts`, `app/api/allegati/[id]/route.ts` | Upload/download/delete WebDAV falliti per cause tecniche. |
| Provisioning Nextcloud | `app/api/crm-settings/utenti/route.ts`, `app/api/crm-settings/utenti/[id]/nextcloud/route.ts` | Provisioning utente, app-password o gruppo falliti. |
| Roberta | `app/api/crm-settings/roberta/knowledge/sync/route.ts`, `app/api/public/roberta-knowledge/route.ts` | Sync conoscenza fallita, fonte non leggibile, ricerca non disponibile. |
| Offerta commerciale | `app/api/offerta-commerciale/upload/route.ts`, `app/api/offerta-commerciale/sync/route.ts` | Upload/sync Nextcloud, parsing PDF/listino, pubblicazione catalogo falliti. |
| Email transazionali | `lib/auth/user-provisioning.ts`, `lib/email/mailer.ts` | Welcome/reset email fallita per errore SMTP/config. |

## Registro controlli

| Data | Punto | Esito | Azione | Owner | Stato |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | Aperto |

## Registro asset/accessi/scadenze

| Asset | Owner | Scadenza/rotazione | Ultimo controllo | Note |
|---|---|---|---|---|
| Dominio e DNS Aruba | TBD | TBD | TBD | Include accesso pannello e rinnovo |
| Vercel | TBD | TBD | TBD | Piano, owner, deploy token/secrets |
| Supabase | TBD | TBD | TBD | Piano, owner, service role key, anon key |
| Nextcloud/Hetzner | TBD | TBD | TBD | Account admin, app-password, snapshot |
| Make | TBD | TBD | TBD | Owner organization, webhook, scenari critici |
| AWS SES | TBD | TBD | TBD | SMTP/API, reputazione, bounce |
| Meta | TBD | TBD | TBD | App, webhook, token, Business Manager |
| OpenAI/Anthropic | TBD | TBD | TBD | API key, billing, limiti, uso token |
| Carbone | TBD | TBD | TBD | API key/account |
| OpenAPI e-Signatures | TBD | TBD | TBD | API key/account/certificati |

