-- Zoho Clienti carries operational status values not covered by the old demo check.
alter table public.clienti
drop constraint if exists clienti_stato_check;
