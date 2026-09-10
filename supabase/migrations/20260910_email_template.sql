-- Libreria dei modelli e-mail.
--
-- Oggi ogni email si riscrive da zero: su Zoho ne esistono 56, di cui 18
-- davvero usati (Sopralluogo Confermativo, Ritardo installazione, Notifica
-- mancato incasso...). Quelli vanno recuperati prima dello spegnimento,
-- perche' l'API non li restituisce completi e a Zoho spento non ci sono piu'.
--
-- I modelli sono condivisi: un modello utile serve a tutti, e tenerli
-- personali ripeterebbe il limite dei filtri salvati di Zoho.
--
-- Il corpo e' HTML con i segnaposto gia' in uso nell'invio di massa
-- ({nome}, {cognome}, {email}, {telefono}): stessa resa, cosi' un modello
-- funziona sia nell'invio singolo sia in quello massivo.

begin;

create table if not exists public.crm_email_template (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  /** Modulo di destinazione: "clienti", "lead", "installatori". */
  modulo text not null,
  oggetto text not null,
  corpo text not null,
  /** Cartella di raggruppamento, come su Zoho. */
  cartella text,
  attivo boolean not null default true,
  /** Origine Zoho, per non reimportare due volte lo stesso modello. */
  zoho_id text,
  creato_da uuid references public.utenti(id) on delete set null,
  creato_il timestamptz not null default now(),
  modificato_da uuid references public.utenti(id) on delete set null,
  modificato_il timestamptz,
  constraint crm_email_template_nome_non_vuoto check (length(btrim(nome)) > 0),
  constraint crm_email_template_oggetto_non_vuoto check (length(btrim(oggetto)) > 0),
  -- Due modelli con lo stesso nome nello stesso modulo renderebbero
  -- l'elenco illeggibile al momento di sceglierne uno.
  constraint crm_email_template_nome_unico unique (modulo, nome)
);

create unique index if not exists crm_email_template_zoho_idx
  on public.crm_email_template (zoho_id)
  where zoho_id is not null;

create index if not exists crm_email_template_modulo_idx
  on public.crm_email_template (modulo, nome)
  where attivo;

comment on table public.crm_email_template is
  'Modelli e-mail condivisi. corpo = HTML con segnaposto {nome}, {cognome}, {email}, {telefono}.';

-- ---------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------
-- Lettura a chiunque sia autenticato: chi puo' scrivere un'email deve poter
-- scegliere un modello. La scrittura passa dall'applicazione, che verifica
-- il permesso configurabile email_template.gestione.
alter table public.crm_email_template enable row level security;

drop policy if exists crm_email_template_select on public.crm_email_template;
create policy crm_email_template_select
  on public.crm_email_template for select to authenticated
  using (true);

grant select on public.crm_email_template to authenticated;
revoke all on public.crm_email_template from anon;

notify pgrst, 'reload schema';

commit;
