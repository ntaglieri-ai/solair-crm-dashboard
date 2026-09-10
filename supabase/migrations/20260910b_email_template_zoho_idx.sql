-- Indice su zoho_id utilizzabile per l'upsert.
--
-- Era stato creato parziale (`where zoho_id is not null`) per non occupare
-- spazio sui modelli scritti a mano. Ma PostgreSQL accetta un indice
-- parziale come bersaglio di ON CONFLICT solo se la stessa condizione viene
-- ripetuta nella query, e i client non lo fanno: l'importazione dei modelli
-- da Zoho falliva su tutte le righe.
--
-- Un indice unico normale risolve: PostgreSQL non considera due valori nulli
-- come duplicati, quindi i modelli senza origine Zoho restano liberi.

begin;

drop index if exists public.crm_email_template_zoho_idx;

create unique index if not exists crm_email_template_zoho_idx
  on public.crm_email_template (zoho_id);

notify pgrst, 'reload schema';

commit;
