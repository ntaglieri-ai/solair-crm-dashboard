-- Le note (attivita) avevano policy RLS per select/insert/delete ma non per
-- update: quando e' arrivata la modifica/cancellazione recuperabile delle
-- note (20260909e, che aggiunge eliminato/testo via UPDATE), e' rimasta
-- senza una policy propria. Postgres nega di default cio' che nessuna
-- policy concede: l'UPDATE veniva eseguito senza errore ma toccava zero
-- righe, quindi "modifica" e "elimina" apparivano riuscite in UI e
-- sparivano al primo reload.
--
-- Stessa forma di attivita_delete: solo SUPERADMIN/ADMIN, e solo se il
-- record genitore esiste ancora.

begin;

drop policy if exists attivita_update on public.attivita;
create policy attivita_update
  on public.attivita for update to authenticated
  using (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and case attivita.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = attivita.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = attivita.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = attivita.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = attivita.record_id)
      else false
    end
  )
  with check (
    (select coalesce(public.current_ruolo_code(), '')) in ('SUPERADMIN', 'ADMIN')
    and case attivita.record_tipo
      when 'lead' then exists (select 1 from public.leads x where x.id = attivita.record_id)
      when 'cliente' then exists (select 1 from public.clienti x where x.id = attivita.record_id)
      when 'compito' then exists (select 1 from public.compiti x where x.id = attivita.record_id)
      when 'installatore' then exists (select 1 from public.installatori x where x.id = attivita.record_id)
      else false
    end
  );

notify pgrst, 'reload schema';

commit;
