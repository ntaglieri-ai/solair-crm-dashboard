-- RLS per le tre tabelle del modulo Offerta Commerciale.
--
-- Perche' servono: le tabelle avevano RLS attiva e ZERO policy, cioe' erano
-- raggiungibili solo in service_role. Andava bene finche' l'unico consumatore
-- erano le route dell'app (tutte e 11 usano createAdminClient), ma il server
-- MCP interroga Supabase impersonando l'utente reale via JWT: senza queste
-- policy il listino e le offerte gli risultavano semplicemente inesistenti.
--
-- Perche' la SELECT e' ristretta e non aperta a tutti gli `authenticated`:
-- qui dentro ci sono prezzi di listino e codici sconto, e su questo progetto
-- la superficie esposta e' PostgREST diretto, non l'app. Aprire la lettura a
-- ogni utente autenticato regalerebbe il listino completo a un AGENT via API.
-- Le route dell'app non se ne accorgono in nessun caso: leggono in
-- service_role, che salta comunque la RLS.
--
-- Applicata a mano in SQL Editor il 24/08/2026 e verificata con pg_policies:
-- 12 policy, 4 per tabella. Questo file e' la traccia nel repo, non e' da
-- rigiocare con db push.

-- Blocco 1/3 — offerta_commerciale_cataloghi
create policy "offerta_cataloghi_select"
  on public.offerta_commerciale_cataloghi for select to authenticated
  using ((select public.has_full_row_visibility()));

create policy "offerta_cataloghi_insert"
  on public.offerta_commerciale_cataloghi for insert to authenticated
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_cataloghi_update"
  on public.offerta_commerciale_cataloghi for update to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'))
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_cataloghi_delete"
  on public.offerta_commerciale_cataloghi for delete to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

-- Blocco 2/3 — offerta_commerciale_offerte
create policy "offerta_offerte_select"
  on public.offerta_commerciale_offerte for select to authenticated
  using ((select public.has_full_row_visibility()));

create policy "offerta_offerte_insert"
  on public.offerta_commerciale_offerte for insert to authenticated
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_offerte_update"
  on public.offerta_commerciale_offerte for update to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'))
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_offerte_delete"
  on public.offerta_commerciale_offerte for delete to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

-- Blocco 3/3 — offerta_commerciale_documenti
create policy "offerta_documenti_select"
  on public.offerta_commerciale_documenti for select to authenticated
  using ((select public.has_full_row_visibility()));

create policy "offerta_documenti_insert"
  on public.offerta_commerciale_documenti for insert to authenticated
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_documenti_update"
  on public.offerta_commerciale_documenti for update to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'))
  with check (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));

create policy "offerta_documenti_delete"
  on public.offerta_commerciale_documenti for delete to authenticated
  using (coalesce((select public.current_ruolo_code()), '') in ('SUPERADMIN','ADMIN'));
