-- Correzioni segnalate dagli advisor di Supabase (db advisors --type performance).
-- Nessuna cambia il comportamento visibile: sono tutte equivalenze.
--
-- NB: non risolvono la variabilità delle prestazioni, che è dovuta alla CPU
-- burstable dell'istanza Micro (misurato: query mediana 65ms, p90 884ms, su un
-- database di 36 MB con 100% di cache hit). Sono igiene, non la cura.

-- 1) INDICI DUPLICATI -------------------------------------------------------
-- Sette coppie di indici identici. Ogni scrittura li aggiornava entrambi.
-- Di ogni coppia si tiene quello effettivamente usato, secondo pg_stat_user_indexes:
--   clienti_stato_idx            110 usi  vs  idx_clienti_stato         0
--   compiti_scadenza_idx         784      vs  idx_compiti_scadenza     60
--   compiti_stato_idx           2167      vs  idx_compiti_stato         0
--   leads_lead_proprietario_id_idx 1052   vs  idx_leads_proprietario    4
--   idx_leads_sede               430      vs  leads_sede_idx            0
--   leads_stato_lead_idx        1927      vs  idx_leads_stato           7
-- Per sede su clienti entrambi sono a 0 usi: si tiene quello con la
-- denominazione coerente col resto della tabella.
drop index if exists public.idx_clienti_sede;
drop index if exists public.idx_clienti_stato;
drop index if exists public.idx_compiti_scadenza;
drop index if exists public.idx_compiti_stato;
drop index if exists public.idx_leads_proprietario;
drop index if exists public.leads_sede_idx;
drop index if exists public.idx_leads_stato;

-- 2) POLICY CHE CHIAMANO auth.role() PER OGNI RIGA --------------------------
-- Erano `to public using (auth.role() = 'authenticated')`: la funzione veniva
-- rivalutata riga per riga. Concedere la policy direttamente al ruolo
-- `authenticated` con `using (true)` dà lo stesso identico risultato — un
-- anonimo era già escluso dal confronto — senza chiamare alcuna funzione.
do $$
declare
  t text;
begin
  foreach t in array array['tag', 'installatore_tags', 'installatore_zone', 'installatore_zone_raggio']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated', t
    );
  end loop;
end
$$;

-- 3) cartelle_preferite: auth.uid() e auth.jwt() dentro una sottoquery -------
-- Stessa espressione, ma con le funzioni avvolte in (select ...) così Postgres
-- le valuta una volta sola (InitPlan) invece che per ogni riga. La policy passa
-- anche da `public` ad `authenticated`, coerentemente col resto.
drop policy if exists cartelle_preferite_self on public.cartelle_preferite;
create policy cartelle_preferite_self on public.cartelle_preferite
  for all to authenticated
  using (
    utente_id in (
      select utenti.id from utenti
      where utenti.auth_user_id = (select auth.uid())
         or lower(utenti.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  )
  with check (
    utente_id in (
      select utenti.id from utenti
      where utenti.auth_user_id = (select auth.uid())
         or lower(utenti.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

-- 4) permessi_cartelle_nextcloud: due policy permissive sullo stesso SELECT --
-- `_read` concede la lettura a tutti gli autenticati (`using true`), mentre
-- `_admin_write` era dichiarata `for all`, quindi veniva valutata anche in
-- lettura pur non potendo cambiarne l'esito. Si restringe alle sole scritture:
-- il SELECT resta coperto da una policy sola.
drop policy if exists permessi_cartelle_nextcloud_admin_write on public.permessi_cartelle_nextcloud;
create policy permessi_cartelle_nextcloud_admin_insert on public.permessi_cartelle_nextcloud
  for insert to authenticated with check ((select nc_path_perms_can_write()));
create policy permessi_cartelle_nextcloud_admin_update on public.permessi_cartelle_nextcloud
  for update to authenticated
  using ((select nc_path_perms_can_write()))
  with check ((select nc_path_perms_can_write()));
create policy permessi_cartelle_nextcloud_admin_delete on public.permessi_cartelle_nextcloud
  for delete to authenticated using ((select nc_path_perms_can_write()));
