-- Clienti: Stato a scelta multipla, come in Zoho ("Installato;Logistica").
--
-- La colonna e' gia' text e usa gia' il formato degli altri campi a scelta
-- multipla dei clienti (valori separati da ";"): nessuna conversione di tipo,
-- quindi la vista clienti_report_list non va toccata. Opzioni invariate in
-- crm_column_values e crm_stato_cliente; crm_custom_fields resta "select".
-- Il lavoro vero e' nel codice (filtri sui singoli valori, badge, menu).
--
-- Decisioni del 2026-09-26: backup della colonna; default
-- 'Nuovo contratto digitale' tolto (non e' uno stato configurato e nessun
-- cliente lo usa): la colonna resta senza default.
--
-- Da eseguire A MANO in Supabase SQL Editor, UN BLOCCO ALLA VOLTA.


-- ═══ BLOCCO 0 — situazione PRIMA (sola lettura) ═════════════════════════════
-- Atteso: data_type text, default 'Nuovo contratto digitale'::text;
-- 744 clienti di cui 20 con piu' stati ("…;…").

select data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'clienti' and column_name = 'stato';

select count(*) as clienti,
       count(stato) as con_stato,
       count(*) filter (where stato like '%;%') as con_piu_stati
from public.clienti;


-- ═══ BLOCCO 1 — colonna di backup ═══════════════════════════════════════════
-- Rilanciabile: la copia avviene solo nella transazione che crea la colonna.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clienti' and column_name = 'stato_bak_20260926'
  ) then
    alter table public.clienti add column stato_bak_20260926 text;
    update public.clienti set stato_bak_20260926 = stato where stato is not null;
  end if;
end $$;

comment on column public.clienti.stato_bak_20260926 is
  'Backup di stato prima del passaggio a scelta multipla del 2026-09-26.';

commit;

-- Verifica: 0 differenze, 729 valori copiati (744 clienti meno 15 senza stato).
select count(*) filter (where stato is distinct from stato_bak_20260926) as differenze,
       count(stato_bak_20260926) as copiati
from public.clienti;


-- ═══ BLOCCO 2 — niente default ══════════════════════════════════════════════

alter table public.clienti alter column stato drop default;

-- Verifica: column_default = null.
select column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'clienti' and column_name = 'stato';
