# Zoho -> CRM sync

Scope: manual CSV data sync from Zoho CRM to this CRM.

Current modules:
- `leads`
- `clienti`
- `compiti`
- `scadenze`

The current engine is dry-run only. It may write diagnostic rows to
`zoho_sync_runs` and `zoho_sync_events` when database logging is enabled, but it
must not write to operational tables such as `leads` or `clienti`.

## Rules

- Zoho is the source of truth only for explicitly mapped Zoho fields.
- Native CRM fields and workflows are out of scope for the sync.
- Updates must be built from a whitelist of mapped columns.
- Do not use broad object spreads or generic record updates.
- Empty/null values from Zoho do not overwrite existing CRM values on updates.
  They are logged as diffs for visibility, but excluded from writable payloads.
- Do not delete records.
- Do not write to Zoho.
- Do not enable write-mode without explicit confirmation.

## CRM workflows out of scope

The Lead -> Cliente conversion workflow is separate from this sync.

Do not call, replace, or modify:

- `app/api/leads/[id]/converti/route.ts`

Customers created by CRM conversion have `clienti.lead_id` and no
`clienti.zoho_record_id`; the sync must not match them as existing Zoho records.

## Useful commands

```bash
node scripts/zoho-sync/test-leads-dry-run.mjs --no-db-log
node scripts/zoho-sync/test-clienti-dry-run.mjs --no-db-log
node scripts/zoho-sync/test-compiti-dry-run.mjs --no-db-log
node scripts/zoho-sync/test-scadenze-dry-run.mjs --no-db-log
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint lib/zoho-sync scripts/zoho-sync lib/clienti/zoho-fields.ts
```
