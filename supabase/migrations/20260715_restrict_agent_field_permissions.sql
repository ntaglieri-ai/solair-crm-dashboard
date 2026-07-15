-- Applica la policy campo consigliata per ruoli operativi.
-- I campi non elencati restano invariati; i valori sono quelli supportati
-- da permessi_campo.accesso: hidden, readonly, editable.

alter table public.permessi_campo
  add column if not exists modulo text,
  add column if not exists campo text,
  add column if not exists campo_nome text,
  add column if not exists accesso text default 'hidden',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'permessi_campo'
      and column_name = 'field'
  ) then
    execute 'update public.permessi_campo set campo = field where campo is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'permessi_campo'
      and column_name = 'field_key'
  ) then
    execute 'update public.permessi_campo set campo = field_key where campo is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'permessi_campo'
      and column_name = 'column_name'
  ) then
    execute 'update public.permessi_campo set campo = column_name where campo is null';
  end if;

  update public.permessi_campo
     set campo = campo_nome
   where campo is null
     and campo_nome is not null;

  update public.permessi_campo
     set campo_nome = campo
   where campo_nome is null
     and campo is not null;
end $$;

alter table public.permessi_campo
  drop constraint if exists permessi_campo_accesso_check;

update public.permessi_campo
   set accesso = case lower(accesso)
     when 'visibile' then 'editable'
     when 'modificabile' then 'editable'
     when 'rw' then 'editable'
     when 'solo lettura' then 'readonly'
     when 'readonly' then 'readonly'
     when 'r' then 'readonly'
     when 'nascosto' then 'hidden'
     when 'mascherato' then 'hidden'
     when 'hidden' then 'hidden'
     else 'hidden'
   end
 where accesso is not null;

alter table public.permessi_campo
  alter column accesso set default 'hidden',
  add constraint permessi_campo_accesso_check
    check (accesso in ('hidden', 'readonly', 'editable'));

create unique index if not exists permessi_campo_ruolo_modulo_campo_uidx
  on public.permessi_campo (ruolo_id, modulo, campo);

with target_fields(modulo, campo, agent_access, standard_access, director_access) as (
  values
    ('lead', 'codice_postale', 'hidden', 'keep', 'keep'),
    ('lead', 'created_at', 'hidden', 'keep', 'keep'),
    ('lead', 'creato_da', 'hidden', 'keep', 'keep'),
    ('lead', 'data_click', 'hidden', 'keep', 'keep'),
    ('lead', 'ora_ultima_attivita', 'hidden', 'keep', 'keep'),
    ('lead', 'stato_email', 'hidden', 'keep', 'keep'),
    ('lead', 'updated_at', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_account_convertito_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_connesso_a_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_contatto_convertito_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_creato_da_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_installatore_sopralluogo_id', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_last_seen_at', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_modified_at', 'hidden', 'keep', 'keep'),
    ('lead', 'zoho_owner_id', 'hidden', 'keep', 'keep'),
    ('clienti', 'bonifico1', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'bonifico2', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'bonifico_parziale', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'bonificopdc', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'citta_indirizzo_postale', 'hidden', 'keep', 'keep'),
    ('clienti', 'clienti_proprietario_zoho_id', 'hidden', 'keep', 'keep'),
    ('clienti', 'codice_fiscale', 'hidden', 'keep', 'keep'),
    ('clienti', 'codice_ordine_sonepar', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'codice_postale_indirizzo', 'hidden', 'keep', 'keep'),
    ('clienti', 'cognome_intestatario_utenza_elettrica', 'hidden', 'keep', 'keep'),
    ('clienti', 'created_at', 'hidden', 'keep', 'keep'),
    ('clienti', 'creato_da', 'hidden', 'keep', 'keep'),
    ('clienti', 'creato_da_zoho_id', 'hidden', 'keep', 'keep'),
    ('clienti', 'data_click', 'hidden', 'keep', 'keep'),
    ('clienti', 'di_cui_ct3', 'hidden', 'keep', 'keep'),
    ('clienti', 'di_cui_ftv', 'hidden', 'keep', 'keep'),
    ('clienti', 'e_mail_enel_gaudi', 'hidden', 'keep', 'keep'),
    ('clienti', 'fattura1', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'fattura2', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'fatturapdc', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'finanziamento_approvato', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'iban', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'importo_contrattuale', 'hidden', 'keep', 'keep'),
    ('clienti', 'importo_da_listino', 'hidden', 'keep', 'keep'),
    ('clienti', 'importo_finanziamento', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'importo_tica', 'hidden', 'keep', 'keep'),
    ('clienti', 'incentivoatteso', 'hidden', 'keep', 'keep'),
    ('clienti', 'indirizzo_di_ritiro_merce', 'hidden', 'keep', 'keep'),
    ('clienti', 'installatore_zoho_id', 'hidden', 'keep', 'keep'),
    ('clienti', 'iva', 'hidden', 'keep', 'keep'),
    ('clienti', 'iva_reverse_charge', 'hidden', 'keep', 'keep'),
    ('clienti', 'locked', 'hidden', 'keep', 'keep'),
    ('clienti', 'mod_pagamento_ct3_0', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'modalita_di_pagamento', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'modificato_da', 'hidden', 'keep', 'keep'),
    ('clienti', 'modificato_da_zoho_id', 'hidden', 'keep', 'keep'),
    ('clienti', 'n_1_tranche', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'n_2tranche', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'n_rate_e_importo_rata', 'hidden', 'keep', 'keep'),
    ('clienti', 'nome_intestatario_utenza_elettrica', 'hidden', 'keep', 'keep'),
    ('clienti', 'note_provvigioni', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'ora_creazione', 'hidden', 'keep', 'keep'),
    ('clienti', 'ora_modifica', 'hidden', 'keep', 'keep'),
    ('clienti', 'ora_ultima_attivita', 'hidden', 'keep', 'keep'),
    ('clienti', 'pod', 'hidden', 'keep', 'keep'),
    ('clienti', 'provincia_indirizzo_postale', 'hidden', 'keep', 'keep'),
    ('clienti', 'saldo', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'sconto_combo', 'hidden', 'keep', 'keep'),
    ('clienti', 'stato_provvigione', 'hidden', 'hidden', 'hidden'),
    ('clienti', 'tot_contratto', 'hidden', 'keep', 'keep'),
    ('clienti', 'updated_at', 'hidden', 'keep', 'keep'),
    ('clienti', 'via_indirizzo_postale', 'hidden', 'keep', 'keep'),
    ('clienti', 'zoho_modified_at', 'hidden', 'keep', 'keep'),
    ('clienti', 'zoho_record_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'correlato_zoho_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'created_at', 'hidden', 'keep', 'keep'),
    ('compiti', 'creato_da', 'hidden', 'keep', 'keep'),
    ('compiti', 'creato_da_nome', 'hidden', 'keep', 'keep'),
    ('compiti', 'creato_da_zoho_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'locked', 'hidden', 'keep', 'keep'),
    ('compiti', 'modificato_da_nome', 'hidden', 'keep', 'keep'),
    ('compiti', 'modificato_da_zoho_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'nome_contatto_zoho_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'ora_creazione', 'hidden', 'keep', 'keep'),
    ('compiti', 'ora_modifica', 'hidden', 'keep', 'keep'),
    ('compiti', 'ora_ultima_attivita', 'hidden', 'keep', 'keep'),
    ('compiti', 'proprietario_zoho_id', 'hidden', 'keep', 'keep'),
    ('compiti', 'updated_at', 'hidden', 'keep', 'keep'),
    ('compiti', 'zoho_record_id', 'hidden', 'keep', 'keep'),
    ('scadenze', 'created_at', 'hidden', 'keep', 'keep'),
    ('scadenze', 'updated_at', 'hidden', 'keep', 'keep'),
    ('scadenze', 'zoho_id', 'hidden', 'keep', 'keep'),
    ('installatori', 'created_at', 'hidden', 'keep', 'keep'),
    ('installatori', 'updated_at', 'hidden', 'keep', 'keep'),
    ('installatori', 'zoho_id', 'hidden', 'keep', 'keep')
),
resolved as (
  select
    r.id as ruolo_id,
    f.modulo,
    f.campo,
    case upper(coalesce(r.code, r.nome))
      when 'AGENT' then f.agent_access
      when 'STANDARD' then f.standard_access
      when 'DIRECTOR' then f.director_access
      else 'keep'
    end as accesso
  from public.ruoli r
  cross join target_fields f
  where upper(coalesce(r.code, r.nome)) in ('AGENT', 'STANDARD', 'DIRECTOR')
)
insert into public.permessi_campo (ruolo_id, modulo, campo, campo_nome, accesso)
select ruolo_id, modulo, campo, campo, accesso
from resolved
where accesso <> 'keep'
on conflict (ruolo_id, modulo, campo) do update set
  accesso = excluded.accesso,
  campo_nome = excluded.campo_nome,
  updated_at = now();
