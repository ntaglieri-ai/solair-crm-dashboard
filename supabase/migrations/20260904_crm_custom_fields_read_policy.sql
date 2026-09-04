-- crm_custom_fields e' stata creata con RLS abilitata e ZERO policy (solo
-- service_role, via backend, puo' leggerla/scriverla) — corretto per le
-- operazioni di gestione schema (crea/modifica/elimina colonna), ma troppo
-- restrittivo per il caso d'uso "mostra il campo nella scheda cliente": un
-- utente normale che apre una scheda non ha service_role, quindi la lettura
-- falliva silenziosamente (RLS nega, non da' errore, torna zero righe).
--
-- Questa policy apre SOLA LETTURA ai soli campi visibili e non cancellati —
-- e' metadata non sensibile (etichetta, tipo, nome colonna), non i dati
-- veri del cliente. Scrittura (INSERT/UPDATE/DELETE) resta riservata al
-- backend service_role: nessuna policy le abilita qui.
create policy "crm_custom_fields_select_visible"
  on public.crm_custom_fields
  for select
  to authenticated
  using (visible = true and deleted_at is null);
