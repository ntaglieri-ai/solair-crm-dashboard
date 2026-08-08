-- Canale preferito per installatore (spec FASE 3, punto 3.4): su quale canale
-- inviare la scheda sopralluogo.
--
-- Prima di questa migration il canale era deciso da un controllo hardcoded sul
-- nome in lib/automazioni/handoff.ts ("Diesse" -> email, tutti gli altri ->
-- WhatsApp): un rename dell'anagrafica o un secondo installatore via email
-- avrebbero richiesto una modifica al codice. Ora e' un dato dell'installatore.
--
-- Default 'email' (non 'whatsapp') per due motivi: e' l'unico canale davvero
-- operativo oggi — Spoki e' pronto ma in attesa di account attivo (vedi
-- lib/whatsapp/spoki-client.ts) — e un default sul canale bloccato farebbe
-- fallire l'inoltro di ogni installatore nuovo appena creato. Quando Spoki
-- sara' attivo il canale si cambia da UI, installatore per installatore.

begin;

alter table installatori
  add column if not exists canale_preferito text not null default 'email';

-- Constraint separata dalla add column: e' idempotente solo cosi' (l'inline
-- check verrebbe ricreata anche quando la colonna esiste gia').
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'installatori_canale_preferito_check'
  ) then
    alter table installatori
      add constraint installatori_canale_preferito_check
      check (canale_preferito in ('email', 'whatsapp'));
  end if;
end $$;

-- SEED: Diesse esplicito a 'email'. Ridondante rispetto al default (l'add
-- column ha gia' riempito tutte le righe esistenti), ma scritto qui perche' e'
-- l'unico canale confermato dalla procedura Vito e non un valore ereditato per
-- caso dal default. Gli altri 7 restano 'email' finche' non si cambia da UI:
-- nessuno ha WhatsApp attivo oggi.
update installatori
set canale_preferito = 'email', updated_at = now()
where nome ilike '%diesse%';

-- Guardia: se Diesse non e' stato trovato (rename dell'anagrafica), la
-- migration fallisce invece di lasciar credere che il seed sia passato.
do $$
begin
  if not exists (select 1 from installatori where nome ilike '%diesse%') then
    raise exception 'Nessun installatore Diesse trovato: canale preferito non seminato';
  end if;
end $$;

commit;

-- Verifica rapida dopo l'esecuzione:
-- select nome, canale_preferito from installatori order by nome;
