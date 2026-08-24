-- Consenso al contatto via email sui Clienti.
--
-- Speculare a 20260809_lead_contact_consents.sql, ma limitata al solo canale
-- email: e' quello su cui il CRM invia davvero (vedi lib/email/consent.ts).
-- Telefono e WhatsApp verso i Clienti oggi non passano da qui, quindi non si
-- creano colonne che nessuno leggerebbe.
--
-- ATTENZIONE al default false: come gia' successo sui lead, tutti i clienti
-- importati da Zoho nascono "senza consenso" per costruzione, non per rifiuto.
-- Finche' il flag non viene valorizzato (toggle in scheda Cliente) l'invio
-- email verso quel cliente e' bloccato.
alter table public.clienti
  add column if not exists consenso_contatto_email boolean not null default false;

comment on column public.clienti.consenso_contatto_email is
  'Consenso esplicito del cliente a essere ricontattato via email. Verificato server-side prima di ogni invio, singolo o di massa.';
