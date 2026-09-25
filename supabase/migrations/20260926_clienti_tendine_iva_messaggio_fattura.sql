-- Clienti: iva, messaggio_fattura, impianto_in_edilizia_libera, area_vincolata
-- da numeric/boolean a text, come le tendine Zoho da cui arrivano.
--
-- Sostituisce 20260913c_clienti_picklist_column_types (mai eseguita, rinominata
-- in .superata). Decisioni del 2026-09-26:
--   - i valori attuali vengono SVUOTATI nella conversione e restano nelle
--     colonne *_bak_20260926; li riscrive poi l'update Zoho
--     (final-zoho-delta.mjs --step update --campi ...) dove Zoho ha un valore;
--   - le opzioni sono gia' in crm_column_values (verificate nel blocco 3);
--   - crm_custom_fields dichiara i 4 campi come tendine (tipo select), cosi'
--     CRM Settings li mostra come tali.
--
-- Da eseguire A MANO in Supabase SQL Editor, UN BLOCCO ALLA VOLTA, controllando
-- l'output di ogni blocco prima di passare al successivo.


-- ═══ BLOCCO 0 — conteggi PRIMA (sola lettura) ═══════════════════════════════
-- Atteso: iva 721 null / 16 "10" / 5 "0" / 1 "22" / 1 "1458";
-- messaggio_fattura 744 null; impianto 740 null / 4 true;
-- area 740 null / 1 true / 3 false.

select 'iva' as colonna, iva::text as valore, count(*) from public.clienti group by iva
union all
select 'messaggio_fattura', messaggio_fattura::text, count(*) from public.clienti group by messaggio_fattura
union all
select 'impianto_in_edilizia_libera', impianto_in_edilizia_libera::text, count(*) from public.clienti group by impianto_in_edilizia_libera
union all
select 'area_vincolata', area_vincolata::text, count(*) from public.clienti group by area_vincolata
order by 1, 3 desc;


-- ═══ BLOCCO 1 — colonne di backup ═══════════════════════════════════════════
-- Stesso tipo dell'originale. Rilanciabile: se il backup esiste gia' non viene
-- riscritto (la copia avviene solo nella transazione che crea le colonne).

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clienti' and column_name = 'iva_bak_20260926'
  ) then
    alter table public.clienti
      add column iva_bak_20260926 numeric,
      add column messaggio_fattura_bak_20260926 boolean,
      add column impianto_in_edilizia_libera_bak_20260926 boolean,
      add column area_vincolata_bak_20260926 boolean;

    update public.clienti set
      iva_bak_20260926 = iva,
      messaggio_fattura_bak_20260926 = messaggio_fattura,
      impianto_in_edilizia_libera_bak_20260926 = impianto_in_edilizia_libera,
      area_vincolata_bak_20260926 = area_vincolata
    where iva is not null
       or messaggio_fattura is not null
       or impianto_in_edilizia_libera is not null
       or area_vincolata is not null;
  end if;
end $$;

comment on column public.clienti.iva_bak_20260926 is
  'Backup di iva (numeric) prima della conversione in tendina del 2026-09-26.';
comment on column public.clienti.messaggio_fattura_bak_20260926 is
  'Backup di messaggio_fattura (boolean) prima della conversione in tendina del 2026-09-26.';
comment on column public.clienti.impianto_in_edilizia_libera_bak_20260926 is
  'Backup di impianto_in_edilizia_libera (boolean) prima della conversione in tendina del 2026-09-26.';
comment on column public.clienti.area_vincolata_bak_20260926 is
  'Backup di area_vincolata (boolean) prima della conversione in tendina del 2026-09-26.';

commit;

-- Verifica backup: ogni coppia deve dare 0 differenze.
select
  count(*) filter (where iva is distinct from iva_bak_20260926) as diff_iva,
  count(*) filter (where messaggio_fattura is distinct from messaggio_fattura_bak_20260926) as diff_messaggio_fattura,
  count(*) filter (where impianto_in_edilizia_libera is distinct from impianto_in_edilizia_libera_bak_20260926) as diff_impianto,
  count(*) filter (where area_vincolata is distinct from area_vincolata_bak_20260926) as diff_area,
  count(iva_bak_20260926) as bak_iva_valorizzati,                                  -- atteso 23
  count(impianto_in_edilizia_libera_bak_20260926) as bak_impianto_valorizzati,     -- atteso 4
  count(area_vincolata_bak_20260926) as bak_area_valorizzati                       -- atteso 4
from public.clienti;


-- ═══ BLOCCO 2 — conversione in text + vista clienti_report_list ═════════════
-- Tutto in una transazione: se qualcosa fallisce non cambia nulla.
-- La vista dipende dalle colonne: va eliminata e ricreata. La definizione qui
-- sotto e' quella letta dal DB il 2026-09-26 (pg_get_viewdef), identica,
-- con gli stessi permessi (authenticated: select; service_role: tutti) e
-- security_invoker.

begin;

drop view if exists public.clienti_report_list;

alter table public.clienti
  alter column iva type text using null::text,
  alter column messaggio_fattura type text using null::text,
  alter column impianto_in_edilizia_libera type text using null::text,
  alter column area_vincolata type text using null::text;

create view public.clienti_report_list
with (security_invoker = true) as
SELECT c.id,
    c.lead_id,
    c.nome,
    c.cognome,
    c.nome_clienti,
    c.saluti,
    c.codice_fiscale,
    c.email,
    c.email_secondaria,
    c.cellulare,
    c.altro_telefono,
    c.via_indirizzo_postale,
    c.citta_indirizzo_postale,
    c.provincia_indirizzo_postale,
    c.codice_postale_indirizzo,
    c.stato,
    c.modalita_iscrizione_annullata,
    c.ora_iscrizione_annullata,
    c.clienti_proprietario_id,
    c.origine_lead,
    c.sede,
    c.installatore_id,
    c.wallbox,
    c.cantiere_multiplo,
    c.descrizione,
    c.note,
    c.note_ufficio,
    c.note_pagamenti,
    c.note_provvigioni,
    c.visita_piu_recente,
    c.prima_pagina_visitata,
    c.tempo_medio_impiegato_minuti,
    c.numero_di_chat,
    c.relatore,
    c.punteggio_visitatore,
    c.prima_visita,
    c.giorni_visitati,
    c.social_lead_id,
    c.codice_rintracciabilita,
    c.stato_provvigione,
    c.creato_da,
    c.modificato_da,
    c.data_click,
    c.ora_ultima_attivita,
    c.created_at,
    c.updated_at,
    c.zoho_record_id,
    c.clienti_proprietario_zoho_id,
    c.clienti_proprietario,
    c.creato_da_zoho_id,
    c.modificato_da_zoho_id,
    c.ora_creazione,
    c.ora_modifica,
    c.e_mail_secondaria,
    c.tag,
    c.zoho_modified_at,
    c.locked,
    c.ora_ultimo_arricchimento,
    c.stato_arricchito,
    c.cod_inverter,
    c.cod_moduli,
    c.cod_storage,
    c.disponibilita_magazzino,
    c.installatore_zoho_id,
    c.installatore,
    c.nr_inverter,
    c.nr_moduli,
    c.potenza_moduli_wp,
    c.nr_batterie,
    c.capacita_batterie,
    c.totale_storage,
    c.tot_potenza_dc,
    c.potenza_inverter,
    c.modalita_di_pagamento,
    c.tot_potenza_ac_kw,
    c.n_1_tranche,
    c.importo_contrattuale,
    c.bonifico_parziale,
    c.importo_finanziamento,
    c.n_2tranche,
    c.saldo,
    c.stratigrafia_superficie_di_installazione,
    c.c_o_magazzino_installatore,
    c.indirizzo_di_ritiro_merce,
    c.merce_ordinata_e_da_ritirare,
    c.c_o_cantiere_del_cliente,
    c.altri_materiali,
    c.importi_extra,
    c.assistenza,
    c.data_installazione_ultimata,
    c.inserimento_pratica_gse,
    c.iva_reverse_charge,
    c.iva,
    c.n_rate_e_importo_rata,
    c.data_ammissibilita,
    c.data_sopralluogo,
    c.corrispettivo_pagato,
    c.mappa_catastale,
    c.regolamento_di_esecizio,
    c.attestato_terna,
    c.codice_contratto_pnrr,
    c.data_conferma_iter_e_distribuzione,
    c.notifica_pred_reg_esercizio,
    c.disponibilita_fine_lavori,
    c.tica,
    c.stato_tica,
    c.importo_da_listino,
    c.inserimento_pratica_e_distribuzione,
    c.impianto_in_edilizia_libera,
    c.area_vincolata,
    c.potenza_nominale_superiore_20kw,
    c.pod,
    c.zona,
    c.stato_sollecito,
    c.tipo_ctr,
    c.iban,
    c.finanziamento_approvato,
    c.verifica_documentale,
    c.layout_verificato,
    c.scheda_enea,
    c.data_scadenza_tica,
    c.importo_tica,
    c.impianto_attivo,
    c.data_appuntamento_allaccio,
    c.tipologia,
    c.retrofit,
    c.data_interlocutorio,
    c.eps,
    c.stato_sopralluogo,
    c.data_affidamento_sopralluogo,
    c.data_iter_enel_concluso,
    c.messaggio_di_benvenuto,
    c.messaggio_prog_preliminare,
    c.messaggio_ordine_merce,
    c.messaggio_in_esecuzione,
    c.telefonata_post_installazione,
    c.messaggio_fattura,
    c.mod_pagamento_ct3_0,
    c.intervento_2,
    c.intervento_1,
    c.fattura2,
    c.fattura1,
    c.sconto_combo,
    c.bonifico2,
    c.bonifico1,
    c.st300,
    c.scaldacqua_pdc,
    c.pdc_idronica,
    c.stf,
    c.accessori,
    c.litri_accumulo,
    c.n_collettori,
    c.bonificopdc,
    c.p_d_c_idronica,
    c.fatturapdc,
    c.incentivoatteso,
    c.di_cui_ct3,
    c.tot_contratto,
    c.di_cui_ftv,
    c.codice_inv_batt,
    c.codice_ordine_sonepar,
    c.foglio,
    c.cer,
    c.sub,
    c.particella,
    c.tipo_di_tensione,
    c.nome_intestatario_utenza_elettrica,
    c.e_mail_enel_gaudi,
    c.cognome_intestatario_utenza_elettrica,
    c.titolarita_impianto,
    c.desidera_installare_impianto_su,
    c.tipologia_proprietario,
    c.potenza_sistema_di_accumulo,
    c.flag_eps,
    c.flag_cer,
    c.costi_extra_sopralluogo,
    c.zoho_synced_at,
    c.data_fatt_pagamento,
    c.consenso_contatto_email,
    c.richiesta_saldo,
    c.configurazione_cer,
    c.campaign_name,
    c.meta_campaign_id,
    c.meta_campaign_name,
    c.meta_adset_id,
    c.meta_adset_name,
    c.meta_ad_id,
    c.meta_ad_name,
    c.meta_form_id,
    COALESCE(c.ora_modifica, c.updated_at, c.created_at) AS modifica_visualizzata,
    COALESCE(c.ora_creazione, c.created_at) AS creazione_visualizzata,
    lower(COALESCE(NULLIF(btrim(u.nome), ''::text), NULLIF(btrim(c.clienti_proprietario), ''::text),
        CASE
            WHEN c.clienti_proprietario_id IS NOT NULL THEN 'Utente non disponibile'::text
            ELSE 'Non assegnato'::text
        END)) AS proprietario_ordinamento
   FROM clienti c
     LEFT JOIN utenti u ON u.id = c.clienti_proprietario_id;

revoke all on public.clienti_report_list from public, anon, authenticated;
grant select on public.clienti_report_list to authenticated;
grant all on public.clienti_report_list to service_role;

notify pgrst, 'reload schema';

commit;

-- Verifica: 4 righe con data_type = text, e la vista risponde.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'clienti'
  and column_name in ('iva', 'messaggio_fattura', 'impianto_in_edilizia_libera', 'area_vincolata');
select count(*) as righe_vista from public.clienti_report_list;   -- atteso 744 (o il totale clienti)


-- ═══ BLOCCO 3 — opzioni in crm_column_values ════════════════════════════════
-- Le opzioni esistono gia' (verificato il 2026-09-26): l'insert e' una rete di
-- sicurezza e non fa nulla se ci sono. Etichette identiche a Zoho, perche'
-- l'update Zoho scrive solo valori che coincidono con un'opzione attiva.

insert into public.crm_column_values (table_name, column_name, value, label, active, sort_order)
select v.table_name, v.column_name, v.value, v.label, true, v.sort_order
from (values
  ('clienti', 'iva', 'iva_inclusa', 'IVA INCLUSA', 0),
  ('clienti', 'iva', 'imponibile', 'IMPONIBILE', 1),
  ('clienti', 'messaggio_fattura', 'i_fattura', 'I Fattura', 0),
  ('clienti', 'messaggio_fattura', 'ii_fattura', 'II Fattura', 1),
  ('clienti', 'messaggio_fattura', 'iii_fattura', 'III Fattura', 2),
  ('clienti', 'impianto_in_edilizia_libera', 'si', 'Si', 0),
  ('clienti', 'impianto_in_edilizia_libera', 'no', 'No', 1),
  ('clienti', 'area_vincolata', 'si', 'Si', 0),
  ('clienti', 'area_vincolata', 'no', 'No', 1)
) as v(table_name, column_name, value, label, sort_order)
where not exists (
  select 1 from public.crm_column_values c
  where c.table_name = v.table_name and c.column_name = v.column_name and c.value = v.value
);

-- Verifica: 9 righe, tutte active = true.
select column_name, value, label, active, sort_order
from public.crm_column_values
where table_name = 'clienti'
  and column_name in ('iva', 'messaggio_fattura', 'impianto_in_edilizia_libera', 'area_vincolata')
order by column_name, sort_order;


-- ═══ BLOCCO 4 — tipo del campo in CRM Settings (crm_custom_fields) ══════════
-- Senza riga, CRM Settings deduce il tipo dalla colonna (prima number/boolean,
-- dopo il blocco 2 sarebbe "text"): la riga lo dichiara tendina. Stessa forma
-- delle altre tendine di sistema (es. "sede"): field_key = nome colonna,
-- options vuote (i valori stanno in crm_column_values), ordinamento = posizione
-- della colonna. Rilanciabile (vincolo unico table_name, column_name).

insert into public.crm_custom_fields
  (modulo, field_key, label, tipo, required, visible, system, options, ordinamento,
   table_name, column_name, db_type, formato, sola_lettura)
select 'clienti', v.column_name, v.label, 'select', false, true, true, '[]'::jsonb,
       c.ordinal_position, 'clienti', v.column_name, 'text', '{}'::jsonb, false
from (values
  ('iva', 'IVA'),
  ('messaggio_fattura', 'Messaggio Fattura'),
  ('impianto_in_edilizia_libera', 'Impianto in edilizia libera'),
  ('area_vincolata', 'Area vincolata')
) as v(column_name, label)
join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = 'clienti' and c.column_name = v.column_name
on conflict (table_name, column_name) do nothing;

-- Verifica: 4 righe, tipo select, db_type text.
select column_name, label, tipo, db_type, ordinamento
from public.crm_custom_fields
where table_name = 'clienti'
  and column_name in ('iva', 'messaggio_fattura', 'impianto_in_edilizia_libera', 'area_vincolata')
  and deleted_at is null;


-- ═══ BLOCCO 5 — conteggi DOPO (sola lettura) ════════════════════════════════
-- Atteso: tutte e 4 le colonne a null su tutti i clienti, finche' non gira
-- l'update Zoho. I valori di prima restano in *_bak_20260926.

select 'iva' as colonna, iva as valore, count(*) from public.clienti group by iva
union all
select 'messaggio_fattura', messaggio_fattura, count(*) from public.clienti group by messaggio_fattura
union all
select 'impianto_in_edilizia_libera', impianto_in_edilizia_libera, count(*) from public.clienti group by impianto_in_edilizia_libera
union all
select 'area_vincolata', area_vincolata, count(*) from public.clienti group by area_vincolata
order by 1, 3 desc;
