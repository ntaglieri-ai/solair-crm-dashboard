-- Identita sorgente e dati Zoho necessari a una sincronizzazione Lead
-- incrementale. La migrazione non elimina ne modifica record esistenti.

alter table public.leads
  add column if not exists zoho_id text,
  add column if not exists zoho_owner_id text,
  add column if not exists zoho_creato_da_id text,
  add column if not exists zoho_account_convertito_id text,
  add column if not exists zoho_contatto_convertito_id text,
  add column if not exists zoho_installatore_sopralluogo_id text,
  add column if not exists zoho_connesso_a_id text,
  add column if not exists zoho_modified_at timestamptz,
  add column if not exists zoho_last_seen_at timestamptz,
  add column if not exists saluti text,
  add column if not exists convertito boolean,
  add column if not exists bloccato boolean;

create unique index if not exists leads_zoho_id_unique
  on public.leads (zoho_id);

create index if not exists leads_zoho_owner_id_idx
  on public.leads (zoho_owner_id);

-- Il CRM possiede già public.tag e public.lead_tags. Manteniamo un solo
-- catalogo tag e rendiamo univoci i nomi all'interno di ciascun modulo.
create unique index if not exists tag_modulo_nome_unique
  on public.tag (modulo, lower(nome));

create index if not exists lead_tags_tag_id_idx
  on public.lead_tags (tag_id);

comment on column public.leads.zoho_id is
  'ID record Zoho senza prefisso zcrm_; chiave della sincronizzazione.';

comment on column public.leads.zoho_last_seen_at is
  'Ultimo export Zoho in cui il record era presente.';
