-- Apply before deploying the report fixes. No business data is changed.
begin;

create or replace view public.clienti_report_list
with (security_invoker = true) as
select c.id, c.nome, c.cognome, c.nome_clienti, c.email, c.cellulare,
  c.codice_fiscale, c.tag, c.stato, c.sede, c.zona, c.installatore,
  c.installatore_id, c.clienti_proprietario, c.clienti_proprietario_id,
  c.consenso_contatto_email, c.created_at, c.updated_at,
  c.ora_modifica, c.ora_creazione,
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
