-- permessi_ui e permessi_campo: RLS attiva con ZERO policy, cioe' deny-all.
--
-- Le due tabelle hanno rispettivamente 75 e 179 righe che nessun utente
-- autenticato riusciva a leggere ne' a scrivere. Le conseguenze erano due, ed
-- entrambe silenziose:
--
--   1. lib/permissions/load-permissions.ts legge permessi_campo con il client
--      dell'utente. Zero righe lette significa snapshot.fields vuoto, quindi
--      fieldAccess() cadeva sempre sul default del ruolo. Le 179 restrizioni
--      configurate (IBAN, codice fiscale, importi) non arrivavano mai al
--      motore: erano inerti per costruzione, non per una dimenticanza in UI.
--
--   2. savePermissions() legge permessi_ui per capire quali chiavi aggiornare.
--      Con RLS deny-all la SELECT non fallisce: torna zero righe senza errore.
--      Il codice ne deduceva "niente da aggiornare" e usciva in anticipo,
--      saltando anche le scritture successive su permessi_campo e
--      permessi_azione, e restituendo comunque successo. Il pannello Permessi
--      diceva "salvato" e non aveva salvato niente.
--
-- Le policy qui sotto ricalcano esattamente quelle gia' presenti su
-- permessi_pagina, permessi_record e permessi_azione: lettura aperta a chi e'
-- autenticato, scrittura a chi puo' gestire i ruoli. Nessun criterio nuovo.
--
-- Lettura aperta e' voluta e non una svista: il motore permessi deve poter
-- costruire lo snapshot di CHIUNQUE, e un utente che non riesce a leggere le
-- proprie restrizioni finirebbe per non averne — cioe' il caso piu' permissivo.
-- Qui il default sicuro e' leggere.

-- --- permessi_ui ------------------------------------------------------------
drop policy if exists permessi_ui_read on public.permessi_ui;
create policy permessi_ui_read
  on public.permessi_ui for select to authenticated
  using (true);

drop policy if exists permessi_ui_manager_insert on public.permessi_ui;
create policy permessi_ui_manager_insert
  on public.permessi_ui for insert to authenticated
  with check ((select public.permessi_can_manage_roles()));

drop policy if exists permessi_ui_manager_update on public.permessi_ui;
create policy permessi_ui_manager_update
  on public.permessi_ui for update to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

-- --- permessi_campo ---------------------------------------------------------
drop policy if exists permessi_campo_read on public.permessi_campo;
create policy permessi_campo_read
  on public.permessi_campo for select to authenticated
  using (true);

drop policy if exists permessi_campo_manager_insert on public.permessi_campo;
create policy permessi_campo_manager_insert
  on public.permessi_campo for insert to authenticated
  with check ((select public.permessi_can_manage_roles()));

drop policy if exists permessi_campo_manager_update on public.permessi_campo;
create policy permessi_campo_manager_update
  on public.permessi_campo for update to authenticated
  using ((select public.permessi_can_manage_roles()))
  with check ((select public.permessi_can_manage_roles()));

-- DELETE serve solo qui e non sulle sorelle: savePermissions() cancella le
-- righe jolly (campo = '*') quando arriva una configurazione per campo, per
-- non lasciare una regola generica che continui a vincere su quelle puntuali.
drop policy if exists permessi_campo_manager_delete on public.permessi_campo;
create policy permessi_campo_manager_delete
  on public.permessi_campo for delete to authenticated
  using ((select public.permessi_can_manage_roles()));
