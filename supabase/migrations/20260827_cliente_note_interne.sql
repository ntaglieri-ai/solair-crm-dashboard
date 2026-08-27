-- =====================================================================
-- Note interne sulle schede cliente.
--
-- Tabella SEPARATA da `attivita` (dove vivono le note normali, con
-- record_tipo = 'cliente'): non e' una variante della nota esistente, e'
-- un canale riservato alla direzione. Tenerle nella stessa tabella
-- avrebbe significato difendere una singola colonna-discriminante con la
-- RLS, e ogni futura query su `attivita` avrebbe dovuto ricordarsene.
--
-- Requisito: visibili SOLO a SUPERADMIN / ADMIN / DIRECTOR ("Direttore"
-- nell'anagrafica ruoli). Per tutti gli altri — AGENT incluso — la
-- tabella deve risultare vuota, non negata: nessuna traccia. La RLS e'
-- l'enforcement vero, la UI si limita a non disegnare la sezione.
--
-- Soft delete: `eliminato` + `eliminato_il`. Le note cancellate restano
-- in tabella e le policy NON le filtrano — filtrarle nella policy
-- avrebbe reso impossibile un eventuale ripristino via API utente.
-- Il filtro sta nella lettura applicativa e nell'indice parziale.
-- =====================================================================

create table if not exists public.cliente_note_interne (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clienti(id) on delete cascade,
  contenuto text not null,
  creato_da uuid references public.utenti(id) on delete set null,
  creato_il timestamptz not null default now(),
  modificato_da uuid references public.utenti(id) on delete set null,
  modificato_il timestamptz,
  eliminato boolean not null default false,
  eliminato_il timestamptz,
  constraint cliente_note_interne_contenuto_non_vuoto
    check (length(btrim(contenuto)) > 0),
  -- I due campi del soft delete si muovono insieme: senza questo vincolo
  -- una riga potrebbe risultare eliminata senza data (o viceversa), e il
  -- "quando" di una nota riservata e' meta' dell'informazione.
  constraint cliente_note_interne_eliminato_coerente
    check ((eliminato and eliminato_il is not null) or (not eliminato and eliminato_il is null))
);

-- Le note vive di un cliente, in ordine di inserimento: e' l'unica query
-- di lettura che fa l'app. Indice parziale, cosi' le eliminate non
-- gonfiano l'indice.
create index if not exists cliente_note_interne_cliente_idx
  on public.cliente_note_interne (cliente_id, creato_il desc)
  where not eliminato;

comment on table public.cliente_note_interne is
  'Note interne di direzione sulle schede cliente. Visibili solo a SUPERADMIN/ADMIN/DIRECTOR (RLS). Soft delete via eliminato/eliminato_il.';


-- ---------------------------------------------------------------------
-- Gate di ruolo
-- ---------------------------------------------------------------------
-- SECURITY DEFINER per lo stesso motivo di public.bacheca_can_manage() e
-- crm_settings_can_write_config(): la funzione legge public.utenti, che
-- ha RLS; senza definer la policy ricorrerebbe nella RLS del lettore.
-- coalesce(r.code, r.nome, u.ruolo) perche' i ruoli custom non hanno
-- sempre `code` valorizzato.
create or replace function public.note_interne_can_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.utenti u
    left join public.ruoli r on r.id = u.ruolo_id
    where (
        u.auth_user_id = (select auth.uid())
        or lower(u.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      )
      and upper(coalesce(r.code, r.nome, u.ruolo)) in ('SUPERADMIN', 'ADMIN', 'DIRECTOR')
  );
$$;

revoke all on function public.note_interne_can_access() from public;
grant execute on function public.note_interne_can_access() to authenticated;


-- ---------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------
-- Tutte e quattro passano dallo stesso gate: chi non e' Direttore o piu'
-- non vede, non scrive, non modifica e non cancella. Le chiamate sono
-- wrappate in (select ...) per essere valutate una volta per statement
-- invece che per riga (regola fissa RLS del progetto).
alter table public.cliente_note_interne enable row level security;

drop policy if exists cliente_note_interne_select on public.cliente_note_interne;
create policy cliente_note_interne_select
  on public.cliente_note_interne for select to authenticated
  using ((select public.note_interne_can_access()));

-- L'autore non e' negoziabile: `creato_da` deve essere l'utente della
-- sessione. Impedisce di firmare una nota riservata a nome di un altro
-- passando da PostgREST diretto.
drop policy if exists cliente_note_interne_insert on public.cliente_note_interne;
create policy cliente_note_interne_insert
  on public.cliente_note_interne for insert to authenticated
  with check (
    (select public.note_interne_can_access())
    and creato_da = (select public.current_utente_id())
    and exists (select 1 from public.clienti c where c.id = cliente_note_interne.cliente_id)
  );

drop policy if exists cliente_note_interne_update on public.cliente_note_interne;
create policy cliente_note_interne_update
  on public.cliente_note_interne for update to authenticated
  using ((select public.note_interne_can_access()))
  with check ((select public.note_interne_can_access()));

-- DELETE fisica concessa allo stesso gruppo, ma l'app non la usa: la
-- cancellazione dalla scheda e' il soft delete (update di `eliminato`).
drop policy if exists cliente_note_interne_delete on public.cliente_note_interne;
create policy cliente_note_interne_delete
  on public.cliente_note_interne for delete to authenticated
  using ((select public.note_interne_can_access()));

grant select, insert, update, delete on public.cliente_note_interne to authenticated;
revoke all on public.cliente_note_interne from anon;
