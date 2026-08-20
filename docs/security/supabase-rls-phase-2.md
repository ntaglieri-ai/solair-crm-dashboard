# Supabase security — fase 2: tabelle senza RLS

Questa fase e' intenzionalmente separata dall'hardening dei privilegi RPC del
20 agosto 2026. La migrazione RPC non abilita RLS, non crea policy e non cambia
l'accesso ai dati.

## Evidenza dell'audit live

L'audit live ha rilevato queste **18 tabelle nello schema `public` senza RLS**:

1. `public.attivita`
2. `public.cliente_comunicazioni`
3. `public.cliente_documenti_stato`
4. `public.cliente_impianto`
5. `public.cliente_iter_burocratico`
6. `public.cliente_logistica`
7. `public.cliente_pagamenti`
8. `public.cliente_tags`
9. `public.collegamenti`
10. `public.compito_tags`
11. `public.crm_column_values`
12. `public.crm_settings`
13. `public.documenti`
14. `public.lead_tags`
15. `public.permessi_azione`
16. `public.permessi_pagina`
17. `public.permessi_record`
18. `public.ruoli`

## Strategia a impatto minimo (fase 2A)

La prima migrazione RLS mantiene intenzionalmente tutte le operazioni per
`authenticated` e per il backend `service_role`, ma non definisce alcuna policy
per `anon`. L'effetto atteso e' quindi:

- CRM autenticato: nessun cambiamento funzionale;
- API server-side con `service_role`: nessun cambiamento funzionale;
- sito/configuratore: nessun cambiamento per gli endpoint pubblici mediati dalle
  API; l'accesso anonimo diretto alle 18 tabelle viene invece bloccato;
- Nextcloud: nessun cambiamento, perche' WebDAV e credenziali restano gestiti dal
  backend e non dipendono da policy anonime su queste tabelle.

La policy comune si chiama `crm_authenticated_access`. La migrazione controlla
prima che tutte le 18 tabelle esistano e opera in una singola transazione: se un
controllo o una policy fallisce, nessuna tabella resta in uno stato intermedio.

File preparati:

- `supabase/migrations/20260820_enable_rls_legacy_crm_tables.sql`
- `supabase/rollback/20260820_enable_rls_legacy_crm_tables.rollback.sql`

## Inventario dei call-site

Call-site applicativi diretti rilevati:

- `attivita`: note e storico di lead, clienti e compiti;
- `cliente_tags`: repository clienti e dati di riferimento;
- `collegamenti`: API e repository allegati/link;
- `crm_column_values`: gestione valori predefiniti CRM;
- `crm_settings`: dashboard, profilo, comunicazioni, Spoki, Roberta e impostazioni;
- `lead_tags`: repository lead, sconti e dati di riferimento;
- `permessi_azione`, `permessi_pagina`, `permessi_record`, `ruoli`: motore e UI
  permessi, utenti e path Nextcloud.

Non risultano call-site diretti attivi per `cliente_comunicazioni`,
`cliente_documenti_stato`, `cliente_impianto`, `cliente_iter_burocratico`,
`cliente_logistica`, `cliente_pagamenti`, `compito_tags` e `documenti`; sono
tabelle legacy o raggiunte indirettamente. Anche per queste, `authenticated` e
`service_role` restano abilitati per evitare regressioni da integrazioni non
visibili nel repository.

## Piano della fase 2

Per ciascuna delle 18 tabelle:

1. censire call-site, ruolo Supabase usato e operazioni `select/insert/update/delete`;
2. classificare l'accesso atteso (`anon`, utente autenticato, proprietario,
   ruolo CRM o solo backend `service_role`);
3. predisporre policy esplicite e abilitare RLS nella stessa transazione;
4. verificare API e flussi UI con utenti autorizzati e non autorizzati;
5. predisporre rollback per policy e stato RLS;
6. applicare la fase solo dopo revisione separata e conferma esplicita.

## Stato

- Inventario live: completo, 18 tabelle rilevate e nominate.
- Correzione SQL RLS: predisposta localmente, non applicata.
- Rollback: predisposto localmente.
- Modifiche remote: nessuna.
