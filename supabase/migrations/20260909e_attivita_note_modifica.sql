-- Modifica e cancellazione delle note normali.
--
-- Le note dei moduli (Cliente, Lead, Installatori, Compiti) vivono tutte in
-- `attivita`. Finora si potevano solo scrivere: una nota sbagliata restava
-- in scheda per sempre.
--
-- La cancellazione e' recuperabile, come per le note interne: la riga resta
-- e viene marcata. Una nota cancellata per sbaglio e' un'informazione persa,
-- e in un CRM le informazioni perse non tornano.
--
-- `attivita` contiene anche eventi non-nota (cambio stato, creazione): le
-- colonne nascono con valori che li lasciano intatti, e l'applicazione
-- consente di marcare solo le righe di tipo 'nota'.

begin;

alter table public.attivita
  add column if not exists eliminato boolean not null default false,
  add column if not exists eliminato_il timestamptz,
  add column if not exists modificato_da uuid references public.utenti(id) on delete set null,
  add column if not exists modificato_il timestamptz;

do $$ begin
  -- I due campi della cancellazione si muovono insieme: una riga eliminata
  -- senza data (o viceversa) perderebbe meta' dell'informazione.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attivita'::regclass
      and conname = 'attivita_eliminato_coerente'
  ) then
    alter table public.attivita add constraint attivita_eliminato_coerente
      check ((eliminato and eliminato_il is not null) or (not eliminato and eliminato_il is null));
  end if;
end $$;

-- Le attivita' vive di un record: e' la lettura che fa l'app. Indice
-- parziale, cosi' le eliminate non gonfiano l'indice.
create index if not exists attivita_record_vive_idx
  on public.attivita (record_tipo, record_id, created_at desc)
  where not eliminato;

comment on column public.attivita.eliminato is
  'Cancellazione recuperabile delle note: la riga resta, sparisce dalla scheda.';

notify pgrst, 'reload schema';

commit;
