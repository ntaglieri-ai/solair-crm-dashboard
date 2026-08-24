-- =====================================================================
-- Chiusura di crm_authenticated_access sulle 12 tabelle residue,
-- piu' la revoca trasversale di TRUNCATE ad anon/authenticated.
--
-- Segue il modello gia' applicato a public.cliente_pagamenti
-- (20260824c): la RLS decide l'accesso alla RIGA, permessi_campo decide
-- l'accesso al CAMPO. Dove un ruolo ha almeno un campo non nascosto su
-- una riga, la riga gli viene concessa; la protezione del singolo campo
-- sensibile resta compito di permessi_campo, oggi inerte.
--
-- Tre forme ricorrenti:
--   1. estensioni 1:1 di clienti  -> exists() sul genitore: la
--      subquery e' a sua volta soggetta alle policy di clienti, quindi
--      il figlio eredita lo scoping del padre senza duplicarne il
--      predicato, e resta allineato se il padre cambia.
--   2. tabelle polimorfiche (record_id + record_tipo, nessuna FK) ->
--      case sul record_tipo verso il genitore giusto. Un record_tipo
--      sconosciuto NON matcha nessun ramo: fallisce chiuso.
--   3. configurazione globale senza proprietario -> gate per ruolo,
--      come crm_settings.
--
-- Ogni helper di sessione e' avvolto in (select ...): diventa un
-- InitPlan valutato una volta per query invece che per riga. Conta su
-- lead_tags, che ha 4397 righe.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. cliente_iter_burocratico  (0 righe, 0 chiamanti)
--    Burocratico/legale: POD, TICA, pratiche GSE ed e-distribuzione,
--    codice contratto PNRR. permessi_campo copre solo `pod` (hidden per
--    AGENT); gli altri 19 campi non sono ristretti per nessuno, quindi
--    in lettura entra chiunque veda il cliente. La scrittura resta a
--    SUPERADMIN+ADMIN perche' il contenuto e' burocratico-legale.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_iter_burocratico;

drop policy if exists cliente_iter_burocratico_select on public.cliente_iter_burocratico;
create policy cliente_iter_burocratico_select
  on public.cliente_iter_burocratico for select to authenticated
  using (exists (
    select 1 from public.clienti c where c.id = cliente_iter_burocratico.cliente_id
  ));

drop policy if exists cliente_iter_burocratico_insert on public.cliente_iter_burocratico;
create policy cliente_iter_burocratico_insert
  on public.cliente_iter_burocratico for insert to authenticated
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_iter_burocratico.cliente_id)
  );

drop policy if exists cliente_iter_burocratico_update on public.cliente_iter_burocratico;
create policy cliente_iter_burocratico_update
  on public.cliente_iter_burocratico for update to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_iter_burocratico.cliente_id)
  )
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_iter_burocratico.cliente_id)
  );

drop policy if exists cliente_iter_burocratico_delete on public.cliente_iter_burocratico;
create policy cliente_iter_burocratico_delete
  on public.cliente_iter_burocratico for delete to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_iter_burocratico.cliente_id)
  );


-- ---------------------------------------------------------------------
-- 2. cliente_impianto  (0 righe, 0 chiamanti)
--    Configurazione tecnica: moduli, inverter, storage, potenze.
--    permessi_campo NON restringe nessuno di questi campi: i 55 campi
--    nascosti all'AGENT su `clienti` sono finanziari e anagrafici, non
--    tecnici. Un agente che vede il cliente vede gia' le stesse potenze
--    sulla tabella clienti: negargliele qui sarebbe incoerente.
--    Lettura e scrittura seguono entrambe il genitore.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_impianto;

drop policy if exists cliente_impianto_access on public.cliente_impianto;
create policy cliente_impianto_access
  on public.cliente_impianto for all to authenticated
  using (exists (select 1 from public.clienti c where c.id = cliente_impianto.cliente_id))
  with check (exists (select 1 from public.clienti c where c.id = cliente_impianto.cliente_id));


-- ---------------------------------------------------------------------
-- 3. cliente_documenti_stato  (0 righe, 0 chiamanti)
--    Spunte di avanzamento documentale. Due campi, `fattura1` e
--    `fattura2`, sono hidden per AGENT, DIRECTOR e STANDARD: sono gli
--    unici della tabella con un vincolo dichiarato, ed e' un vincolo
--    economico. Gli altri 6 (mappa catastale, regolamento di esercizio,
--    attestato Terna, scheda ENEA, verifica documentale, layout) non
--    sono ristretti: la riga si concede, la scrittura si stringe.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_documenti_stato;

drop policy if exists cliente_documenti_stato_select on public.cliente_documenti_stato;
create policy cliente_documenti_stato_select
  on public.cliente_documenti_stato for select to authenticated
  using (exists (select 1 from public.clienti c where c.id = cliente_documenti_stato.cliente_id));

drop policy if exists cliente_documenti_stato_insert on public.cliente_documenti_stato;
create policy cliente_documenti_stato_insert
  on public.cliente_documenti_stato for insert to authenticated
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_documenti_stato.cliente_id)
  );

drop policy if exists cliente_documenti_stato_update on public.cliente_documenti_stato;
create policy cliente_documenti_stato_update
  on public.cliente_documenti_stato for update to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_documenti_stato.cliente_id)
  )
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_documenti_stato.cliente_id)
  );

drop policy if exists cliente_documenti_stato_delete on public.cliente_documenti_stato;
create policy cliente_documenti_stato_delete
  on public.cliente_documenti_stato for delete to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (select 1 from public.clienti c where c.id = cliente_documenti_stato.cliente_id)
  );


-- ---------------------------------------------------------------------
-- 4. documenti  (0 righe, 8 file di chiamanti)
--    Polimorfica: record_id + record_tipo, nessuna FK. Metadati di file
--    (nome, url_storage, categoria). Dal 27/07 gli allegati veri stanno
--    su Nextcloud e questa tabella e' rimasta vuota, vedi
--    lib/allegati/repository.ts.
--    Lettura ereditata dal genitore; scrittura ereditata anche lei ma
--    con il vincolo aggiuntivo che chi inserisce sia l'autore: un
--    metadato di file va attribuito a chi lo carica, non a chiunque.
--    `caricato_da` null resta ammesso per gli inserimenti da service_role.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.documenti;

drop policy if exists documenti_select on public.documenti;
create policy documenti_select
  on public.documenti for select to authenticated
  using (
    case documenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = documenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = documenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = documenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = documenti.record_id)
      else false
    end
  );

drop policy if exists documenti_insert on public.documenti;
create policy documenti_insert
  on public.documenti for insert to authenticated
  with check (
    (documenti.caricato_da is null
      or documenti.caricato_da = (select public.current_utente_id()))
    and case documenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = documenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = documenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = documenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = documenti.record_id)
      else false
    end
  );

drop policy if exists documenti_update on public.documenti;
create policy documenti_update
  on public.documenti for update to authenticated
  using (
    case documenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = documenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = documenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = documenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = documenti.record_id)
      else false
    end
  )
  with check (
    case documenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = documenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = documenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = documenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = documenti.record_id)
      else false
    end
  );

drop policy if exists documenti_delete on public.documenti;
create policy documenti_delete
  on public.documenti for delete to authenticated
  using (
    case documenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = documenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = documenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = documenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = documenti.record_id)
      else false
    end
  );


-- ---------------------------------------------------------------------
-- 5. cliente_comunicazioni  (0 righe, 0 chiamanti)
--    Spunte e date dei messaggi inviati al cliente, piu' una nota di
--    assistenza. Nessun campo ristretto da permessi_campo. Operativo:
--    lettura e scrittura seguono il genitore.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_comunicazioni;

drop policy if exists cliente_comunicazioni_access on public.cliente_comunicazioni;
create policy cliente_comunicazioni_access
  on public.cliente_comunicazioni for all to authenticated
  using (exists (select 1 from public.clienti c where c.id = cliente_comunicazioni.cliente_id))
  with check (exists (select 1 from public.clienti c where c.id = cliente_comunicazioni.cliente_id));


-- ---------------------------------------------------------------------
-- 6. cliente_logistica  (0 righe, 0 chiamanti)
--    Magazzino, ritiro merce, date di installazione e allaccio.
--    Operativo. Nota: su `clienti` esiste `indirizzo_di_ritiro_merce`
--    hidden per AGENT, mentre qui la colonna si chiama
--    `indirizzo_ritiro_merce` (senza "di") e quindi non e' coperta da
--    permessi_campo. E' un campo, non una riga: si segnala e si
--    risolve quando permessi_campo verra' reso effettivo.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_logistica;

drop policy if exists cliente_logistica_access on public.cliente_logistica;
create policy cliente_logistica_access
  on public.cliente_logistica for all to authenticated
  using (exists (select 1 from public.clienti c where c.id = cliente_logistica.cliente_id))
  with check (exists (select 1 from public.clienti c where c.id = cliente_logistica.cliente_id));


-- ---------------------------------------------------------------------
-- 7. attivita  (9 righe, 9 file di chiamanti)
--    L'unica delle 12 con dati E superficie applicativa reale.
--    Polimorfica; record_tipo presenti oggi: lead (7), compito (2).
--    `testo`, `valore_precedente` e `valore_nuovo` sono testo libero su
--    qualsiasi campo del genitore: possono contenere il valore di un
--    campo sensibile. Per questo la visibilita' segue il genitore e non
--    e' aperta a tutti gli autenticati come adesso.
--    L'UPDATE non viene concesso a nessuno: una riga di timeline e' un
--    fatto avvenuto: si aggiunge, non si riscrive. Chi deve correggere
--    passa dal service_role.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.attivita;

drop policy if exists attivita_select on public.attivita;
create policy attivita_select
  on public.attivita for select to authenticated
  using (
    case attivita.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = attivita.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = attivita.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = attivita.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = attivita.record_id)
      else false
    end
  );

drop policy if exists attivita_insert on public.attivita;
create policy attivita_insert
  on public.attivita for insert to authenticated
  with check (
    (attivita.utente_id is null
      or attivita.utente_id = (select public.current_utente_id()))
    and case attivita.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = attivita.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = attivita.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = attivita.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = attivita.record_id)
      else false
    end
  );

drop policy if exists attivita_delete on public.attivita;
create policy attivita_delete
  on public.attivita for delete to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and case attivita.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = attivita.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = attivita.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = attivita.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = attivita.record_id)
      else false
    end
  );


-- ---------------------------------------------------------------------
-- 8. collegamenti  (0 righe, 2 file di chiamanti)
--    Link (titolo + url) appesi a un record. Polimorfica come attivita.
--    Operativo: lettura e scrittura seguono il genitore, con
--    l'attribuzione dell'autore sull'insert.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.collegamenti;

drop policy if exists collegamenti_select on public.collegamenti;
create policy collegamenti_select
  on public.collegamenti for select to authenticated
  using (
    case collegamenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = collegamenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = collegamenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = collegamenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = collegamenti.record_id)
      else false
    end
  );

drop policy if exists collegamenti_insert on public.collegamenti;
create policy collegamenti_insert
  on public.collegamenti for insert to authenticated
  with check (
    (collegamenti.creato_da is null
      or collegamenti.creato_da = (select public.current_utente_id()))
    and case collegamenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = collegamenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = collegamenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = collegamenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = collegamenti.record_id)
      else false
    end
  );

drop policy if exists collegamenti_update on public.collegamenti;
create policy collegamenti_update
  on public.collegamenti for update to authenticated
  using (
    case collegamenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = collegamenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = collegamenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = collegamenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = collegamenti.record_id)
      else false
    end
  )
  with check (
    case collegamenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = collegamenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = collegamenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = collegamenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = collegamenti.record_id)
      else false
    end
  );

drop policy if exists collegamenti_delete on public.collegamenti;
create policy collegamenti_delete
  on public.collegamenti for delete to authenticated
  using (
    case collegamenti.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = collegamenti.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = collegamenti.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = collegamenti.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = collegamenti.record_id)
      else false
    end
  );


-- ---------------------------------------------------------------------
-- 9-11. cliente_tags / lead_tags / compito_tags
--    Tabelle ponte record-tag. Bassa sensibilita': non contengono dati,
--    solo l'associazione. Ma dicono CHE tag ha un record, che su un lead
--    e' informazione commerciale — quindi seguono comunque il genitore
--    invece di restare aperte.
--    Platea larga e identica in lettura e scrittura, AGENT compreso:
--    taggare i propri lead e' lavoro quotidiano dell'agente, e lo
--    scoping del genitore basta a impedirgli di taggare quelli altrui.
--    Una policy ALL sola: dove lettura e scrittura coincidono,
--    spezzarla in quattro aggiungerebbe righe senza aggiungere
--    controllo.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.cliente_tags;
drop policy if exists cliente_tags_access on public.cliente_tags;
create policy cliente_tags_access
  on public.cliente_tags for all to authenticated
  using (exists (select 1 from public.clienti c where c.id = cliente_tags.cliente_id))
  with check (exists (select 1 from public.clienti c where c.id = cliente_tags.cliente_id));

drop policy if exists crm_authenticated_access on public.lead_tags;
drop policy if exists lead_tags_access on public.lead_tags;
create policy lead_tags_access
  on public.lead_tags for all to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_tags.lead_id))
  with check (exists (select 1 from public.leads l where l.id = lead_tags.lead_id));

drop policy if exists crm_authenticated_access on public.compito_tags;
drop policy if exists compito_tags_access on public.compito_tags;
create policy compito_tags_access
  on public.compito_tags for all to authenticated
  using (exists (select 1 from public.compiti c where c.id = compito_tags.compito_id))
  with check (exists (select 1 from public.compiti c where c.id = compito_tags.compito_id));


-- ---------------------------------------------------------------------
-- 12. crm_column_values  (0 righe, 1 file di chiamanti)
--    Configurazione globale: valori ammessi, etichette e colori delle
--    colonne a tendina. Nessun proprietario, nessun genitore.
--    Lettura aperta a tutti gli autenticati — serve a rendere la UI, e
--    negarla romperebbe le tendine per i ruoli operativi. Scrittura ai
--    soli SUPERADMIN+ADMIN, stesso criterio delle chiavi system.* di
--    crm_settings: e' configurazione, non dato di lavoro.
-- ---------------------------------------------------------------------
drop policy if exists crm_authenticated_access on public.crm_column_values;

drop policy if exists crm_column_values_select on public.crm_column_values;
create policy crm_column_values_select
  on public.crm_column_values for select to authenticated
  using (true);

drop policy if exists crm_column_values_insert on public.crm_column_values;
create policy crm_column_values_insert
  on public.crm_column_values for insert to authenticated
  with check ((select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN'));

drop policy if exists crm_column_values_update on public.crm_column_values;
create policy crm_column_values_update
  on public.crm_column_values for update to authenticated
  using ((select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN'))
  with check ((select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN'));

drop policy if exists crm_column_values_delete on public.crm_column_values;
create policy crm_column_values_delete
  on public.crm_column_values for delete to authenticated
  using ((select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN'));


-- ---------------------------------------------------------------------
-- 13. TRUNCATE: revoca trasversale
--    anon e authenticated hanno TRUNCATE su tutte e 59 le tabelle di
--    public: e' il default Supabase, non una scelta di questo progetto.
--    TRUNCATE NON e' soggetto a row level security: nessuna delle
--    policy scritte sopra lo fermerebbe.
--    Oggi non e' raggiungibile via PostgREST, che non emette mai
--    TRUNCATE, quindi non e' sfruttabile con la sola anon key. Resta
--    un privilegio che nessuno dei due ruoli ha motivo di avere.
--    Il secondo statement serve perche' senza di lui ogni tabella
--    creata in futuro se lo riprende dai default privileges.
-- ---------------------------------------------------------------------
revoke truncate on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;
