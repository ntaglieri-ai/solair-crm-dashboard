begin;

alter table public.attivita
  add column if not exists formato text not null default 'plain',
  add column if not exists allegati jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attivita'::regclass
      and conname = 'attivita_formato_check'
  ) then
    alter table public.attivita
      add constraint attivita_formato_check
      check (formato in ('plain', 'markdown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attivita'::regclass
      and conname = 'attivita_allegati_array_check'
  ) then
    alter table public.attivita
      add constraint attivita_allegati_array_check
      check (jsonb_typeof(allegati) = 'array');
  end if;
end $$;

comment on column public.attivita.formato is
  'Formato del testo nota: plain per storico, markdown per note create dal composer ricco.';

comment on column public.attivita.allegati is
  'Metadati degli allegati caricati su Nextcloud e collegati alla nota.';

alter table public.crm_email_log
  add column if not exists installatore_id uuid references public.installatori(id) on delete cascade,
  add column if not exists corpo text,
  add column if not exists allegati jsonb not null default '[]'::jsonb;

alter table public.crm_email_log
  drop constraint if exists crm_email_log_un_solo_destinatario;

alter table public.crm_email_log
  add constraint crm_email_log_un_solo_destinatario check (
    (lead_id is not null)::int +
    (cliente_id is not null)::int +
    (installatore_id is not null)::int = 1
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_email_log'::regclass
      and conname = 'crm_email_log_allegati_array_check'
  ) then
    alter table public.crm_email_log
      add constraint crm_email_log_allegati_array_check
      check (jsonb_typeof(allegati) = 'array');
  end if;
end $$;

create index if not exists crm_email_log_installatore_idx
  on public.crm_email_log (installatore_id, data_invio desc)
  where installatore_id is not null;

drop policy if exists crm_email_log_select on public.crm_email_log;
create policy crm_email_log_select
  on public.crm_email_log for select to authenticated
  using (
    (lead_id is not null and exists (
      select 1 from public.leads l where l.id = crm_email_log.lead_id
    ))
    or
    (cliente_id is not null and exists (
      select 1 from public.clienti c where c.id = crm_email_log.cliente_id
    ))
    or
    (installatore_id is not null and exists (
      select 1 from public.installatori i where i.id = crm_email_log.installatore_id
    ))
  );

comment on column public.crm_email_log.corpo is
  'Corpo dell email inviata, salvato per mostrarlo nella scheda del record.';

comment on column public.crm_email_log.allegati is
  'Metadati allegati email, riservato a invii con attachment.';

commit;
