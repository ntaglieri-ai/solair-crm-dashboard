-- Campi presenti nella vista colonne Clienti storica e mancanti nello schema CRM.
-- Sono testuali per preservare il valore originale importato/sincronizzato.

alter table public.clienti
  add column if not exists richiesta_saldo text,
  add column if not exists configurazione_cer text;

comment on column public.clienti.richiesta_saldo is
  'Richiesta Saldo importata da Zoho Clienti.';

comment on column public.clienti.configurazione_cer is
  'Configurazione Cer importata da Zoho Clienti.';
