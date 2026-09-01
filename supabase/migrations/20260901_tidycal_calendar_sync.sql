-- Integrazione TidyCal -> Calendario CRM.
-- Gli eventi esterni non hanno un autore CRM: la loro identita' e' la coppia
-- (origine, external_id), usata dal sync per un upsert idempotente.

alter table public.eventi_calendario
  alter column creato_da drop not null,
  add column if not exists origine text not null default 'crm',
  add column if not exists external_id text,
  add column if not exists external_updated_at timestamptz,
  add column if not exists external_cancelled_at timestamptz;

alter table public.eventi_calendario
  drop constraint if exists eventi_calendario_origine_check;

alter table public.eventi_calendario
  add constraint eventi_calendario_origine_check
  check (origine in ('crm', 'tidycal'));

alter table public.eventi_calendario
  drop constraint if exists eventi_calendario_external_identity_check;

alter table public.eventi_calendario
  add constraint eventi_calendario_external_identity_check
  check (
    (origine = 'crm' and external_id is null and creato_da is not null)
    or (origine = 'tidycal' and external_id is not null and creato_da is null)
  );

alter table public.eventi_calendario
  drop constraint if exists eventi_calendario_origine_external_id_key;

alter table public.eventi_calendario
  add constraint eventi_calendario_origine_external_id_key
  unique (origine, external_id);

create index if not exists eventi_calendario_tidycal_attivi_idx
  on public.eventi_calendario (inizio)
  where origine = 'tidycal' and external_cancelled_at is null;

comment on column public.eventi_calendario.origine is
  'crm per eventi manuali, tidycal per prenotazioni sincronizzate in sola lettura.';
comment on column public.eventi_calendario.external_id is
  'Identificativo stabile nella sorgente esterna; insieme a origine evita duplicati.';
comment on column public.eventi_calendario.external_cancelled_at is
  'Cancellazione nella sorgente. Le righe restano per riconciliazione ma non sono mostrate nel calendario.';

-- La categoria viene aggiunta senza sovrascrivere le personalizzazioni gia'
-- presenti. Se la riga non esiste, il codice applicativo dispone comunque del
-- proprio fallback.
update public.crm_settings
set valore = valore || jsonb_build_array(
  jsonb_build_object('id', 'tidycal', 'nome', 'TidyCal', 'colore', '#0ea5e9')
)
where chiave = 'system.calendario.categorie'
  and jsonb_typeof(valore) = 'array'
  and not exists (
    select 1 from jsonb_array_elements(valore) voce
    where voce ->> 'id' = 'tidycal'
  );
