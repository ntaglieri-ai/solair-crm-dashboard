-- Filtri salvati, condivisi fra tutti gli utenti.
--
-- Su Zoho i filtri salvati sono personali e non condivisibili: chi ne
-- costruisce uno utile non puo' passarlo ai colleghi. Qui sono di tutti fin
-- dall'inizio — e' la ragione principale per cui li rifacciamo invece di
-- importarli.
--
-- La definizione e' l'albero del filtro in jsonb: gruppi con connettore E/O
-- e condizioni, annidati liberamente. Non si traduce qui in SQL: la
-- traduzione avviene a ogni lettura, cosi' un filtro salvato resta valido
-- anche se cambia il modo in cui interroghiamo il database.

begin;

create table if not exists public.crm_filtri_salvati (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  nome text not null,
  definizione jsonb not null,
  creato_da uuid references public.utenti(id) on delete set null,
  creato_il timestamptz not null default now(),
  modificato_da uuid references public.utenti(id) on delete set null,
  modificato_il timestamptz,
  constraint crm_filtri_salvati_nome_non_vuoto check (length(btrim(nome)) > 0),
  constraint crm_filtri_salvati_definizione_oggetto
    check (jsonb_typeof(definizione) = 'object'),
  -- Due filtri con lo stesso nome nello stesso modulo renderebbero l'elenco
  -- illeggibile: chi salva sceglie un nome libero, ma non un doppione.
  constraint crm_filtri_salvati_nome_unico unique (modulo, nome)
);

create index if not exists crm_filtri_salvati_modulo_idx
  on public.crm_filtri_salvati (modulo, nome);

comment on table public.crm_filtri_salvati is
  'Filtri salvati condivisi. definizione = albero del filtro (gruppi E/O annidati).';

-- ---------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------
-- Lettura a chiunque sia autenticato: sono condivisi per definizione, e un
-- filtro non contiene dati, solo criteri. Cosa poi si veda applicandolo
-- resta deciso dalle policy delle tabelle interrogate.
alter table public.crm_filtri_salvati enable row level security;

drop policy if exists crm_filtri_salvati_select on public.crm_filtri_salvati;
create policy crm_filtri_salvati_select
  on public.crm_filtri_salvati for select to authenticated
  using (true);

-- L'autore non e' negoziabile, come per le note: impedisce di creare un
-- filtro a nome di un altro passando da PostgREST diretto.
drop policy if exists crm_filtri_salvati_insert on public.crm_filtri_salvati;
create policy crm_filtri_salvati_insert
  on public.crm_filtri_salvati for insert to authenticated
  with check (creato_da = (select public.current_utente_id()));

-- Modifica ed eliminazione a chi l'ha creato; il controllo per gli
-- amministratori sta nell'applicazione, che usa la chiave di servizio.
drop policy if exists crm_filtri_salvati_update on public.crm_filtri_salvati;
create policy crm_filtri_salvati_update
  on public.crm_filtri_salvati for update to authenticated
  using (creato_da = (select public.current_utente_id()))
  with check (creato_da = (select public.current_utente_id()));

drop policy if exists crm_filtri_salvati_delete on public.crm_filtri_salvati;
create policy crm_filtri_salvati_delete
  on public.crm_filtri_salvati for delete to authenticated
  using (creato_da = (select public.current_utente_id()));

grant select, insert, update, delete on public.crm_filtri_salvati to authenticated;
revoke all on public.crm_filtri_salvati from anon;

notify pgrst, 'reload schema';

commit;
