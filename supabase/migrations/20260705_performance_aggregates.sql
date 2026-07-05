create or replace function public.get_lead_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with status_counts as (
    select
      coalesce(stato_lead, 'Non contattato') as label,
      count(*)::integer as value
    from public.leads
    group by 1
  )
  select jsonb_build_object(
    'total', count(*)::integer,
    'caldi', count(*) filter (where coalesce(valutazione, 0) > 80)::integer,
    'duplicati', 0,
    'nonAssegnati', count(*) filter (where lead_proprietario_id is null)::integer,
    'nuoviOggi', count(*) filter (
      where (created_at at time zone 'Europe/Rome')::date =
        (now() at time zone 'Europe/Rome')::date
    )::integer,
    'byStato', coalesce(
      (select jsonb_object_agg(label, value) from status_counts),
      '{}'::jsonb
    )
  )
  from public.leads;
$$;

grant execute on function public.get_lead_stats() to authenticated;

create or replace function public.get_dashboard_aggregates()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'leadsByStatus', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', value))
      from (
        select coalesce(stato_lead, 'Senza stato') label, count(*)::integer value
        from public.leads
        group by 1
        order by value desc
      ) grouped
    ), '[]'::jsonb),
    'leadLocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sede', sede,
        'provincia', provincia,
        'count', value
      ))
      from (
        select sede, provincia, count(*)::integer value
        from public.leads
        group by sede, provincia
      ) grouped
    ), '[]'::jsonb),
    'leadTrend', coalesce((
      select jsonb_agg(jsonb_build_object('key', month_key, 'count', value))
      from (
        select
          to_char(date_trunc('month', created_at at time zone 'Europe/Rome'), 'YYYY-MM') month_key,
          count(*)::integer value
        from public.leads
        where created_at >= date_trunc('month', now()) - interval '5 months'
        group by 1
        order by 1
      ) grouped
    ), '[]'::jsonb),
    'clientiByStatus', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', value))
      from (
        select coalesce(stato, 'Senza stato') label, count(*)::integer value
        from public.clienti
        group by 1
        order by value desc
      ) grouped
    ), '[]'::jsonb),
    'tasksByStatus', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', value))
      from (
        select coalesce(stato, 'Senza stato') label, count(*)::integer value
        from public.compiti
        group by 1
        order by value desc
      ) grouped
    ), '[]'::jsonb),
    'overdueTasks', (
      select count(*)::integer
      from public.compiti
      where stato is distinct from 'Completato'
        and scadenza < (now() at time zone 'Europe/Rome')::date
    ),
    'deadlines', jsonb_build_object(
      'overdue', (
        select count(*)::integer from public.scadenze
        where data_scadenza < (now() at time zone 'Europe/Rome')::date
      ),
      'next7Days', (
        select count(*)::integer from public.scadenze
        where data_scadenza >= (now() at time zone 'Europe/Rome')::date
          and data_scadenza < (now() at time zone 'Europe/Rome')::date + 7
      ),
      'later', (
        select count(*)::integer from public.scadenze
        where data_scadenza >= (now() at time zone 'Europe/Rome')::date + 7
      )
    )
  );
$$;

grant execute on function public.get_dashboard_aggregates() to authenticated;

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);
create index if not exists leads_stato_lead_idx
  on public.leads (stato_lead);
create index if not exists leads_sede_idx
  on public.leads (sede);
create index if not exists leads_valutazione_idx
  on public.leads (valutazione);
create index if not exists leads_lead_proprietario_id_idx
  on public.leads (lead_proprietario_id);
create index if not exists attivita_record_lookup_idx
  on public.attivita (record_tipo, record_id);
create index if not exists compiti_correlato_lookup_idx
  on public.compiti (correlato_tipo, correlato_id);
create index if not exists lead_tags_lead_id_idx
  on public.lead_tags (lead_id);
