alter table public.leads
  add column if not exists installatore_sopralluogo_id uuid
    references public.installatori(id) on delete set null,
  add column if not exists zoho_installatore_sopralluogo_nome text;

create index if not exists leads_installatore_sopralluogo_id_idx
  on public.leads (installatore_sopralluogo_id);

update public.leads as lead
set installatore_sopralluogo_id = installatore.id
from public.installatori as installatore
where lead.installatore_sopralluogo_id is null
  and lead.zoho_installatore_sopralluogo_id is not null
  and installatore.zoho_id = lead.zoho_installatore_sopralluogo_id;
