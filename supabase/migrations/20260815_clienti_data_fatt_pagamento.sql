-- Campo Zoho aggiunto nell'export Clienti_2026_08_15.csv.
-- Resta nel perimetro sync dati Zoho -> CRM: nessuna funzionalita' CRM usa
-- questa colonna in modo automatico.

alter table public.clienti
  add column if not exists data_fatt_pagamento timestamp with time zone;

comment on column public.clienti.data_fatt_pagamento is
  'Data Fatt/Pagamento importata da Zoho Clienti.';
