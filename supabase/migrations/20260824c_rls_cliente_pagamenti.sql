-- RLS reale su public.cliente_pagamenti, al posto di crm_authenticated_access.
--
-- Perche': la policy generica era `ALL to authenticated USING true`, cioe'
-- nessuna distinzione di ruolo su una tabella che contiene IBAN, bonifici,
-- fatture e importi di contratto.
--
-- Chi entra e chi no lo decide permessi_campo, non un criterio nuovo. Sui 27
-- campi di questa riga configurati sul modulo `clienti`:
--
--   SUPERADMIN / ADMIN  iban, codice_fiscale, importo_contrattuale editable
--                       -> accesso pieno, lettura e scrittura.
--   DIRECTOR            iban e altri 13 hidden, ma importo_contrattuale
--                       editable e 9 campi importi non ristretti
--                       -> ha lavoro legittimo sulla riga: entra in lettura.
--   STANDARD            tutto hidden tranne importo_contrattuale e
--                       codice_fiscale readonly -> entra in lettura.
--   AGENT               hidden su TUTTI e 27 i campi, nessuna eccezione
--                       -> non entra. Dargli la riga e affidarsi alla UI per
--                          nascondere i campi non e' una difesa: la falla e'
--                          PostgREST diretto, che la UI non la vede nemmeno.
--
-- Che il DIRECTOR non debba vedere l'IBAN resta vero, ma e' una questione di
-- CAMPO: la RLS decide la riga. Quel pezzo si chiude quando permessi_campo
-- verra' reso effettivo (oggi e' inerte: 179 righe, zero chiamanti).
--
-- Scrittura piu' stretta della lettura, come su crm_settings: legge chi ha
-- qualcosa da leggere, scrive solo chi ha i campi editable.
--
-- Eredita' dal genitore: `exists` su public.clienti e' a sua volta soggetto
-- alle policy di clienti, quindi la visibilita' del figlio segue quella del
-- padre senza duplicarne il predicato — e resta allineata se domani il padre
-- cambia. La FK e' `on delete cascade`: la cancellazione a cascata non passa
-- da queste policy, ed e' corretto cosi'.
--
-- Ogni helper di sessione e' avvolto in (select ...): diventa un InitPlan
-- valutato una volta per query invece che per riga.

-- BLOCCO 1 - via la policy generica
drop policy if exists crm_authenticated_access on public.cliente_pagamenti;

-- BLOCCO 2 - SELECT: chi ha almeno un campo non nascosto su questa riga
drop policy if exists cliente_pagamenti_select on public.cliente_pagamenti;
create policy cliente_pagamenti_select
  on public.cliente_pagamenti
  for select
  to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), ''))
      in ('SUPERADMIN', 'ADMIN', 'DIRECTOR', 'STANDARD')
    and exists (
      select 1 from public.clienti c where c.id = cliente_pagamenti.cliente_id
    )
  );

-- BLOCCO 3 - INSERT: solo chi ha i campi editable
drop policy if exists cliente_pagamenti_insert on public.cliente_pagamenti;
create policy cliente_pagamenti_insert
  on public.cliente_pagamenti
  for insert
  to authenticated
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (
      select 1 from public.clienti c where c.id = cliente_pagamenti.cliente_id
    )
  );

-- BLOCCO 4 - UPDATE: stessa platea dell'INSERT.
-- USING e WITH CHECK identici: senza WITH CHECK si potrebbe spostare la riga
-- su un cliente non visibile.
drop policy if exists cliente_pagamenti_update on public.cliente_pagamenti;
create policy cliente_pagamenti_update
  on public.cliente_pagamenti
  for update
  to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (
      select 1 from public.clienti c where c.id = cliente_pagamenti.cliente_id
    )
  )
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (
      select 1 from public.clienti c where c.id = cliente_pagamenti.cliente_id
    )
  );

-- BLOCCO 5 - DELETE: stessa platea della scrittura
drop policy if exists cliente_pagamenti_delete on public.cliente_pagamenti;
create policy cliente_pagamenti_delete
  on public.cliente_pagamenti
  for delete
  to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and exists (
      select 1 from public.clienti c where c.id = cliente_pagamenti.cliente_id
    )
  );

-- BLOCCO 6 - verifica
-- Attese 4 righe (select/insert/update/delete), tutte to {authenticated},
-- nessuna con policyname = 'crm_authenticated_access'.
select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'cliente_pagamenti'
order by cmd, policyname;
