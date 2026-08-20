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
- Correzione SQL RLS: non ancora predisposta.
- Modifiche remote: nessuna.
