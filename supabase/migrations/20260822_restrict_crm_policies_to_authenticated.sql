-- Restringe al ruolo `authenticated` le policy di leads, clienti, compiti e
-- installatori, che erano concesse al ruolo `public`.
--
-- Perché: la condizione di quelle policy è nella forma
--   has_full_row_visibility() OR (<tabella>_proprietario_id IS NULL) OR (... = current_utente_id())
-- Il ramo centrale non ha condizioni, quindi ogni riga senza proprietario era
-- leggibile da chiunque potesse raggiungere PostgREST — e siccome il ruolo
-- `public` include `anon`, "chiunque" comprendeva i visitatori non autenticati,
-- che si autenticano con la chiave anon pubblicata nel bundle del browser.
--
-- Misurato in produzione prima di questa migration, senza alcuna sessione:
--   clienti 15 righe su 16, leads 33, compiti 9, installatori 4.
--
-- La fase 2A (20260820_enable_rls_legacy_crm_tables.sql) aveva aggiunto la
-- policy `crm_authenticated_access` senza però restringere queste preesistenti,
-- quindi l'effetto dichiarato in docs/security/supabase-rls-phase-2.md
-- ("l'accesso anonimo diretto alle 18 tabelle viene bloccato") non era stato
-- raggiunto.
--
-- Cosa NON cambia: per un utente autenticato la visibilità resta identica —
-- stessa espressione, stesso comportamento sulle righe senza proprietario. Gli
-- endpoint pubblici (/api/public/*) non sono toccati: girano lato server con la
-- service_role, che ignora le policy RLS.
--
-- Le espressioni non vengono ricopiate a mano: si rileggono da pg_policies e si
-- riapplicano identiche, cambiando solo il ruolo destinatario. Idempotente —
-- dopo la prima esecuzione nessuna policy corrisponde più al filtro.

do $$
declare
  r record;
  stmt text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in ('leads', 'clienti', 'compiti', 'installatori')
      and 'public' = any(roles::text[])
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);

    stmt := format(
      'create policy %I on public.%I for %s to authenticated',
      r.policyname,
      r.tablename,
      lower(r.cmd)
    );

    if r.qual is not null then
      stmt := stmt || format(' using (%s)', r.qual);
    end if;

    if r.with_check is not null then
      stmt := stmt || format(' with check (%s)', r.with_check);
    end if;

    execute stmt;

    raise notice 'policy % su % ristretta a authenticated', r.policyname, r.tablename;
  end loop;
end
$$;
