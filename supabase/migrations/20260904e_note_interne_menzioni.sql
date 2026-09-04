-- Applicare prima del deploy delle menzioni nelle note interne.
-- Nessun nuovo grant/policy: i metadati restano nella tabella riservata esistente.
begin;
alter table public.cliente_note_interne
  add column if not exists menzioni jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.cliente_note_interne'::regclass
      and conname = 'cliente_note_interne_menzioni_array') then
    alter table public.cliente_note_interne add constraint cliente_note_interne_menzioni_array
      check (jsonb_typeof(menzioni) = 'array');
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
