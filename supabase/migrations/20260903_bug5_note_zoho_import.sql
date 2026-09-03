-- Bug 5 (report Vito, cap. 8) — opzione A concordata: le note storiche
-- importate da Zoho sono compresse in clienti.descrizione, invisibili nella
-- timeline "Note cliente" (che legge solo da public.attivita). Questo script
-- le sposta in attivita come UNA nota unica retrodatata per cliente, cosi'
-- compaiono nello storico normale al posto cronologicamente giusto.
--
-- Non tocca/svuota clienti.descrizione: resta li' come backup silenzioso.
-- Idempotente: la clausola NOT EXISTS impedisce di creare doppioni se lo
-- script viene rilanciato per errore.
--
-- Nota: niente colonna "menzioni" nell'insert — la migration che la
-- aggiunge (20260902_note_mentions.sql) non risulta ancora eseguita sul DB
-- reale (l'errore "column menzioni does not exist" lo conferma). Se la
-- lanci prima o dopo questo script non cambia nulla: la colonna ha un
-- default, le righe inserite qui restano compatibili.
--
-- Esegui una volta in Supabase SQL Editor.

insert into public.attivita (tipo, testo, record_id, record_tipo, utente_id, created_at)
select
  'nota',
  '— Importato da Zoho —' || chr(10) || chr(10) || clienti.descrizione,
  clienti.id,
  'cliente',
  null,                    -- autore nullo = mostrato come "Sistema" (vedi app/api/clienti/[id]/notes/route.ts)
  coalesce(clienti.ora_creazione, now())
from public.clienti
where clienti.descrizione is not null
  and btrim(clienti.descrizione) <> ''
  and not exists (
    select 1
    from public.attivita a
    where a.record_tipo = 'cliente'
      and a.record_id = clienti.id
      and a.tipo = 'nota'
      and a.testo like '— Importato da Zoho —%'
  );

-- Verifica dopo l'esecuzione: quante note sono state create.
-- select count(*) from public.attivita where tipo = 'nota' and testo like '— Importato da Zoho —%';
