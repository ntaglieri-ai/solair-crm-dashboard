# Supabase security — fase 1: rilascio hardening RPC

Questa procedura chiude le RPC esposte direttamente senza includere la fase RLS.
Non usare `supabase db push`: la cronologia delle migrazioni remote non e'
allineata con l'archivio locale.

## Ordine obbligatorio

1. Distribuire per prima la modifica a
   `app/api/crm-settings/schema/columns/route.ts`.
2. Verificare in Vercel che `SUPABASE_SERVICE_ROLE_KEY` sia presente
   nell'ambiente di produzione. Non visualizzare, copiare o registrare il valore.
3. Prima della migrazione, eseguire smoke test tramite l'interfaccia CRM con un
   amministratore autorizzato:
   - leggere l'elenco dei campi;
   - aggiungere un campo temporaneo;
   - modificarne etichetta/visibilita';
   - eliminarlo;
   - verificare che un utente privo dell'azione
     `crm_settings.system.schema.manage` riceva un rifiuto.
4. Solo se i test precedenti passano, eseguire manualmente la **singola** query
   `supabase/migrations/20260820_harden_function_execute_privileges.sql`.
5. Dopo la query, verificare:
   - dashboard e statistiche lead;
   - caricamento dello snapshot permessi;
   - gestione e pubblicazione catalogo commerciale;
   - salvataggio e lettura credenziali Nextcloud;
   - salvataggio e lettura credenziali email personali;
   - lettura, aggiunta, modifica ed eliminazione dei campi CRM;
   - rifiuto dell'invocazione diretta delle RPC da `anon` e `authenticated`.

## Condizioni di arresto

Interrompere il rilascio prima della migrazione se la route distribuita non
riesce a gestire i campi, se la service role non e' configurata o se il controllo
permessi non rifiuta l'utente non autorizzato.

Eccezione rilevata durante il rilascio del 20 agosto 2026: la RPC live
`crm_admin_add_column` falliva su `attributi_record.key`, impedendo lo smoke
test di scrittura. La singola migrazione e' stata quindi estesa per riallineare
atomicamente `crm_admin_add_column` e `crm_admin_drop_column` alle
implementazioni canoniche basate su `crm_custom_fields`, prima di restringere i
grant. In questo caso lo smoke test completo deve essere ripetuto subito dopo la
migrazione; la lettura pre-migrazione e il controllo autorizzativo sono passati.

Il primo tentativo della migrazione e' stato annullato atomicamente da Postgres
perche' `public.crm_custom_fields` non esisteva nel database live. Nessun grant
e nessuna funzione sono stati modificati. La migrazione e' stata estesa per
creare la tabella metadata gia' con RLS attiva e senza policy browser; soltanto
la route con service role puo' usarla. Questa tabella nuova non fa parte delle
18 tabelle legacy demandate alla fase 2.

Dopo la migrazione, in caso di regressione confermata, eseguire esclusivamente
`supabase/rollback/20260820_harden_function_execute_privileges.rollback.sql` e
ripetere gli smoke test. Il rollback riapre intenzionalmente i privilegi
precedenti e non e' una soluzione permanente.

## Confine con la fase 2

Questa fase non abilita RLS e non crea policy sulle 18 tabelle censite in
`docs/security/supabase-rls-phase-2.md`. La fase 2 richiede analisi dei call-site,
policy dedicate, test e approvazione separata.

## Stato

- Modifiche locali: predisposte e verificate.
- Deploy applicativo: non eseguito.
- Migrazione remota: non eseguita.
- Database remoto: non modificato.
