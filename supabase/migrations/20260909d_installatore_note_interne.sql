-- =====================================================================
-- Note interne sulle schede installatore.
--
-- Stessa impostazione di cliente_note_interne (migration 20260827): una
-- tabella separata dalle note normali, riservata alla direzione, con la
-- RLS come vero controllo e la UI che si limita a non disegnare la
-- sezione. Le colonne che sul Cliente sono arrivate dopo (menzioni,
-- formato, allegati) nascono qui gia' presenti.
--
-- Requisito: visibili SOLO a SUPERADMIN / ADMIN / DIRECTOR. Per gli
-- agenti la tabella deve risultare vuota, non negata: nessuna traccia.
--
-- Il gate note_interne_can_access() e' gia' definito e non e' legato al
-- Cliente: si riusa cosi' com'e', invece di crearne un secondo che
-- potrebbe divergere.
-- =====================================================================

begin;

create table if not exists public.installatore_note_interne (
  id uuid primary key default gen_random_uuid(),
  installatore_id uuid not null references public.installatori(id) on delete cascade,
  contenuto text not null,
  formato text not null default 'markdown',
  menzioni jsonb not null default '[]'::jsonb,
  allegati jsonb not null default '[]'::jsonb,
  creato_da uuid references public.utenti(id) on delete set null,
  creato_il timestamptz not null default now(),
  modificato_da uuid references public.utenti(id) on delete set null,
  modificato_il timestamptz,
  eliminato boolean not null default false,
  eliminato_il timestamptz,
  constraint installatore_note_interne_contenuto_non_vuoto
    check (length(btrim(contenuto)) > 0),
  constraint installatore_note_interne_formato_check
    check (formato in ('plain', 'markdown')),
  constraint installatore_note_interne_menzioni_array
    check (jsonb_typeof(menzioni) = 'array'),
  constraint installatore_note_interne_allegati_array
    check (jsonb_typeof(allegati) = 'array'),
  -- I due campi del soft delete si muovono insieme: una riga eliminata
  -- senza data (o viceversa) perderebbe meta' dell'informazione.
  constraint installatore_note_interne_eliminato_coerente
    check ((eliminato and eliminato_il is not null) or (not eliminato and eliminato_il is null))
);

-- Le note vive di un installatore, in ordine di inserimento: e' l'unica
-- query di lettura dell'app. Indice parziale, cosi' le eliminate non
-- gonfiano l'indice.
create index if not exists installatore_note_interne_installatore_idx
  on public.installatore_note_interne (installatore_id, creato_il desc)
  where not eliminato;

comment on table public.installatore_note_interne is
  'Note interne di direzione sulle schede installatore. Visibili solo a SUPERADMIN/ADMIN/DIRECTOR (RLS). Soft delete via eliminato/eliminato_il.';

-- ---------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------
-- Stesso gate delle note interne cliente. Le chiamate sono wrappate in
-- (select ...) per essere valutate una volta per statement invece che
-- per riga.
alter table public.installatore_note_interne enable row level security;

drop policy if exists installatore_note_interne_select on public.installatore_note_interne;
create policy installatore_note_interne_select
  on public.installatore_note_interne for select to authenticated
  using ((select public.note_interne_can_access()));

-- L'autore non e' negoziabile: impedisce di firmare una nota riservata a
-- nome di un altro passando da PostgREST diretto.
drop policy if exists installatore_note_interne_insert on public.installatore_note_interne;
create policy installatore_note_interne_insert
  on public.installatore_note_interne for insert to authenticated
  with check (
    (select public.note_interne_can_access())
    and creato_da = (select public.current_utente_id())
    and exists (
      select 1 from public.installatori i
      where i.id = installatore_note_interne.installatore_id
    )
  );

drop policy if exists installatore_note_interne_update on public.installatore_note_interne;
create policy installatore_note_interne_update
  on public.installatore_note_interne for update to authenticated
  using ((select public.note_interne_can_access()))
  with check ((select public.note_interne_can_access()));

-- DELETE fisica concessa allo stesso gruppo, ma l'app non la usa: dalla
-- scheda si fa il soft delete.
drop policy if exists installatore_note_interne_delete on public.installatore_note_interne;
create policy installatore_note_interne_delete
  on public.installatore_note_interne for delete to authenticated
  using ((select public.note_interne_can_access()));

grant select, insert, update, delete on public.installatore_note_interne to authenticated;
revoke all on public.installatore_note_interne from anon;

notify pgrst, 'reload schema';

commit;
