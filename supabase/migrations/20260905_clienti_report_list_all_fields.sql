-- Espone alla lista Clienti tutti i campi del record, non solo il sottoinsieme
-- base usato per ordinamenti/report. Nessun dato business viene modificato.
begin;

drop view if exists public.clienti_report_list;

create view public.clienti_report_list
with (security_invoker = true) as
select
  c.*,
  coalesce(c.ora_modifica, c.updated_at, c.created_at) as modifica_visualizzata,
  coalesce(c.ora_creazione, c.created_at) as creazione_visualizzata,
  lower(coalesce(nullif(btrim(u.nome), ''), nullif(btrim(c.clienti_proprietario), ''),
    case when c.clienti_proprietario_id is not null then 'Utente non disponibile' else 'Non assegnato' end)) as proprietario_ordinamento
from public.clienti c
left join public.utenti u on u.id = c.clienti_proprietario_id;

revoke all on public.clienti_report_list from public, anon, authenticated;
grant select on public.clienti_report_list to authenticated, service_role;
notify pgrst, 'reload schema';

commit;
