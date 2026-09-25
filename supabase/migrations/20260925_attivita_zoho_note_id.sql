-- ID Zoho delle note importate nella timeline.
--
-- L'import delle note Zoho (scripts/migrations/import-zoho-note.mjs) deve
-- essere rilanciabile sul backup finale senza creare doppioni: ogni nota
-- importata porta con se' il proprio ID Zoho (senza prefisso "zcrm_").
--
-- Le note nate nel CRM e gli eventi non-nota restano con zoho_note_id null:
-- l'indice unico ammette piu' null, quindi non vengono toccati.
--
-- Esegui una volta in Supabase SQL Editor.

begin;

alter table public.attivita
  add column if not exists zoho_note_id text;

create unique index if not exists attivita_zoho_note_id_key
  on public.attivita (zoho_note_id);

comment on column public.attivita.zoho_note_id is
  'ID Zoho della nota importata (senza prefisso zcrm_). Null per le note nate nel CRM.';

notify pgrst, 'reload schema';

commit;
