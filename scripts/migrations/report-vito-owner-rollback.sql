-- MANUAL rollback: preserves later owner reassignments and the audit trail.
begin;
update public.clienti c set clienti_proprietario_id = null
from public.report_vito_owner_backfill_audit a
where c.id = a.cliente_id
  and c.clienti_proprietario_id = a.assigned_owner_id
  and c.clienti_proprietario = a.owner_name;
-- Inspect affected count; change to COMMIT only after approval.
rollback;
