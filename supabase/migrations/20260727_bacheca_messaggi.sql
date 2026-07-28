-- Bacheca aziendale: annunci reali, DB-backed.
--
-- Sostituisce il vecchio storage su crm_settings.chiave = 'dashboard.noticeboard'
-- (un blob jsonb riscritto interamente ad ogni salvataggio) con una tabella
-- vera, una riga per annuncio. Niente UPDATE previsto: un annuncio si elimina e
-- si ricrea, quindi nessuna policy di update e nessuna colonna updated_at.

begin;

create table if not exists public.bacheca_messaggi (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  testo text not null,
  livello text not null default 'info',
  pin boolean not null default false,
  -- on delete set null: l'annuncio resta leggibile anche se l'autore viene
  -- rimosso dal CRM (e' una comunicazione aziendale, non un dato personale).
  creato_da uuid references public.utenti(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint bacheca_messaggi_livello_check
    check (livello in ('info', 'attenzione', 'urgente'))
);

-- Ordine di lettura unico dell'app: pin in cima, poi cronologico inverso.
create index if not exists bacheca_messaggi_ordine_idx
  on public.bacheca_messaggi (pin desc, created_at desc);

alter table public.bacheca_messaggi enable row level security;

-- Stesso pattern di nc_path_perms_can_write(): SECURITY DEFINER per evitare
-- ricorsione con la RLS di `utenti`, e code/nome/ruolo in coalesce perche' i
-- ruoli custom non hanno sempre `code` valorizzato.
create or replace function public.bacheca_can_manage()
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

grant execute on function public.bacheca_can_manage() to authenticated;

-- SELECT aperta a tutti gli autenticati: gli annunci sono per l'intera azienda.
drop policy if exists bacheca_messaggi_read on public.bacheca_messaggi;
create policy bacheca_messaggi_read
  on public.bacheca_messaggi
  for select
  to authenticated
  using (true);

-- INSERT/DELETE solo Director+. Le chiamate alla funzione sono wrappate in
-- (select ...) cosi' Postgres le valuta una volta sola per statement invece che
-- per riga (regola fissa RLS del progetto).
drop policy if exists bacheca_messaggi_insert on public.bacheca_messaggi;
create policy bacheca_messaggi_insert
  on public.bacheca_messaggi
  for insert
  to authenticated
  with check ((select public.bacheca_can_manage()));

-- Nessun vincolo su creato_da: un Director+ puo' eliminare qualunque annuncio,
-- non solo i propri (deciso esplicitamente: e' una bacheca aziendale, non
-- personale).
drop policy if exists bacheca_messaggi_delete on public.bacheca_messaggi;
create policy bacheca_messaggi_delete
  on public.bacheca_messaggi
  for delete
  to authenticated
  using ((select public.bacheca_can_manage()));

-- ---------------------------------------------------------------------------
-- Travaso degli annunci gia' pubblicati col vecchio sistema (blob jsonb su
-- crm_settings.chiave = 'dashboard.noticeboard', forma
-- {id,title,body,author,createdAt,pinned}). Tutti entrano come livello 'info':
-- il vecchio schema non aveva il concetto di livello, e 'info' e' il default
-- neutro giusto. `creato_da` si risolve per nome dell'autore quando c'e' una
-- corrispondenza esatta in utenti, altrimenti resta null (l'annuncio e'
-- comunque leggibile: la colonna e' nullable apposta).
--
-- La riga su crm_settings NON viene cancellata: resta li' come backup finche'
-- non hai verificato il travaso. Per rimuoverla dopo:
--   delete from crm_settings where chiave = 'dashboard.noticeboard';
insert into public.bacheca_messaggi (titolo, testo, livello, pin, creato_da, created_at)
select
  legacy.title,
  legacy.body,
  'info',
  coalesce(legacy.pinned, false),
  u.id,
  coalesce(legacy."createdAt", now())
from public.crm_settings s
-- "createdAt" e' dichiarato timestamptz: jsonb_to_recordset casta da solo le
-- stringhe ISO scritte da new Date().toISOString().
-- ::jsonb esplicito: crm_settings.valore e' preesistente alle migration del
-- repo, il cast copre sia json che jsonb che text senza cambiare risultato.
cross join lateral jsonb_to_recordset(
  case
    when jsonb_typeof(s.valore::jsonb) = 'array' then s.valore::jsonb
    else '[]'::jsonb
  end
) as legacy(title text, body text, author text, "createdAt" timestamptz, pinned boolean)
-- lateral + limit 1: due utenti omonimi duplicherebbero l'annuncio con una
-- semplice left join.
left join lateral (
  select u2.id
  from public.utenti u2
  where lower(trim(u2.nome)) = lower(trim(legacy.author))
  limit 1
) u on true
where s.chiave = 'dashboard.noticeboard'
  and coalesce(trim(legacy.title), '') <> ''
  and coalesce(trim(legacy.body), '') <> ''
  -- Idempotente: rilanciare la migration non duplica gli annunci gia' travasati.
  and not exists (
    select 1
    from public.bacheca_messaggi b
    where b.titolo = legacy.title and b.testo = legacy.body
  );

-- Chiave permessi_ui che governa "+ Nuovo annuncio" ed "Elimina" nel widget.
-- E' separata dal ruolo apposta: quando arrivera' il flag SUPERADMIN "solo
-- tecnico" bastera' portare a false questa riga per quel ruolo, senza toccare
-- ne' il componente ne' le policy.
insert into public.permessi_ui (ruolo_id, chiave, abilitato)
select
  r.id,
  'widget.bacheca.gestisci',
  upper(coalesce(r.code, r.nome)) in ('SUPERADMIN', 'ADMIN', 'DIRECTOR')
from public.ruoli r
where not exists (
  select 1
  from public.permessi_ui p
  where p.ruolo_id = r.id and p.chiave = 'widget.bacheca.gestisci'
);

commit;

-- Verifica rapida dopo l'esecuzione:
-- select count(*) from bacheca_messaggi;
-- select r.code, p.abilitato from permessi_ui p join ruoli r on r.id = p.ruolo_id
--   where p.chiave = 'widget.bacheca.gestisci' order by r.code;
