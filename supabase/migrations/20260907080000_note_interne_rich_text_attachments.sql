begin;

alter table public.cliente_note_interne
  add column if not exists formato text not null default 'plain',
  add column if not exists allegati jsonb not null default '[]'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cliente_note_interne'::regclass
      and conname = 'cliente_note_interne_formato_check'
  ) then
    alter table public.cliente_note_interne
      add constraint cliente_note_interne_formato_check
      check (formato in ('plain', 'markdown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cliente_note_interne'::regclass
      and conname = 'cliente_note_interne_allegati_array_check'
  ) then
    alter table public.cliente_note_interne
      add constraint cliente_note_interne_allegati_array_check
      check (jsonb_typeof(allegati) = 'array');
  end if;
end $$;

comment on column public.cliente_note_interne.formato is
  'Formato del testo della nota interna: plain per storico, markdown per note create dal composer ricco.';

comment on column public.cliente_note_interne.allegati is
  'Metadati degli allegati caricati su Nextcloud e collegati alla nota interna.';

notify pgrst, 'reload schema';

commit;
