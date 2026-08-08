-- Flag EPS / CER come booleani veri (procedura Vito, Fase 2 punto 2.5).
--
-- Perche' colonne nuove invece di riusare clienti.eps / clienti.cer: quelle
-- due sono `text` ereditate dall'export Zoho (20260707_clienti_zoho_schema.sql,
-- voci 'eps' e 'cer') e contengono valori liberi storici. Restano intatte come
-- archivio in sola lettura: qui serve un dato che il CRM possa scrivere e
-- filtrare in modo affidabile, non una stringa da interpretare a runtime.
--
-- Tri-stato voluto, quindi niente `not null` e niente default false:
--   null  = non ancora valutato
--   true  = previsto
--   false = valutato, non previsto
-- "Non lo sappiamo ancora" e "sappiamo che no" sono due informazioni diverse
-- per chi lavora la pratica, e un default false le confonderebbe rendendo
-- ogni cliente gia' esistente "valutato come negativo" senza che nessuno lo
-- abbia deciso.

begin;

alter table public.clienti
  add column if not exists flag_eps boolean default null,
  add column if not exists flag_cer boolean default null;

comment on column public.clienti.flag_eps is
  'EPS previsto — tri-stato, null = non ancora valutato. Booleano CRM, distinto dal testo storico Zoho clienti.eps.';

comment on column public.clienti.flag_cer is
  'Adesione CER prevista — tri-stato, null = non ancora valutato. Booleano CRM, distinto dal testo storico Zoho clienti.cer.';

commit;

-- Verifica rapida dopo l'esecuzione:
-- select
--   count(*) filter (where flag_eps is true)  as eps_previsti,
--   count(*) filter (where flag_eps is false) as eps_esclusi,
--   count(*) filter (where flag_eps is null)  as eps_da_valutare,
--   count(*) filter (where flag_cer is true)  as cer_previsti,
--   count(*) filter (where flag_cer is false) as cer_esclusi,
--   count(*) filter (where flag_cer is null)  as cer_da_valutare
-- from public.clienti;
