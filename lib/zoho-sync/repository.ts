import { CLIENTI_CRM_SELECT_COLUMNS, type ClienteCrmRecord } from "./clienti-mapping"
import { COMPITI_CRM_SELECT_COLUMNS, type CompitoCrmRecord } from "./compiti-mapping"
import { LEAD_CRM_SELECT_COLUMNS } from "./mapping"
import { normalizeZohoId } from "./normalizers"
import type {
  FieldDiff,
  LeadCrmRecord,
  SyncDiffResult,
  SupabaseLike,
  ZohoSyncModule,
  ZohoSyncMode,
  ZohoSyncStats,
  ZohoSyncStatus,
} from "./types"

const CHUNK_SIZE = 500

export async function inChunks<T>(
  values: T[],
  callback: (chunk: T[]) => Promise<void>,
  size = CHUNK_SIZE,
) {
  for (let index = 0; index < values.length; index += size) {
    await callback(values.slice(index, index + size))
  }
}

export async function fetchOwnerIdsByZohoId(
  supabase: SupabaseLike,
): Promise<Map<string, string>> {
  const owners = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("utenti")
      .select("id,zoho_id")
      .not("zoho_id", "is", null)
      .range(from, from + 999)
    if (error) throw new Error(`utenti: ${error.message}`)
    for (const row of data ?? []) {
      const zohoId = String(row.zoho_id ?? "").trim()
      if (zohoId) owners.set(zohoId, String(row.id))
    }
    if (!data || data.length < 1000) break
  }
  return owners
}

export async function fetchInstallatoreIdsByZohoId(
  supabase: SupabaseLike,
): Promise<Map<string, string>> {
  const installatori = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("installatori")
      .select("id,zoho_id")
      .not("zoho_id", "is", null)
      .range(from, from + 999)
    if (error) throw new Error(`installatori: ${error.message}`)
    for (const row of data ?? []) {
      const zohoId = String(row.zoho_id ?? "").trim()
      if (zohoId) installatori.set(zohoId, String(row.id))
    }
    if (!data || data.length < 1000) break
  }
  return installatori
}

export async function fetchLeadsByZohoId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, LeadCrmRecord>> {
  const leads = new Map<string, LeadCrmRecord>()
  const uniqueIds = [...new Set(zohoIds.flatMap((id) => (id ? [id, `zcrm_${id}`] : [])))]
  await inChunks(uniqueIds, async (chunk) => {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_CRM_SELECT_COLUMNS.join(","))
      .in("zoho_id", chunk)
    if (error) throw new Error(`leads: ${error.message}`)
    for (const row of ((data ?? []) as unknown as LeadCrmRecord[])) {
      if (row.zoho_id) leads.set(normalizeZohoId(row.zoho_id), row as LeadCrmRecord)
    }
  })
  return leads
}

export async function fetchClientiByZohoRecordId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, ClienteCrmRecord>> {
  const clienti = new Map<string, ClienteCrmRecord>()
  const uniqueIds = [...new Set(zohoIds.flatMap((id) => (id ? [id, `zcrm_${id}`] : [])))]
  await inChunks(uniqueIds, async (chunk) => {
    let columns: string[] = [...CLIENTI_CRM_SELECT_COLUMNS]
    let data: unknown[] | null = null
    for (;;) {
      const result = await supabase
        .from("clienti")
        .select(columns.join(","))
        .in("zoho_record_id", chunk)
      if (!result.error) {
        data = (result.data ?? []) as unknown[]
        break
      }

      const missingColumn = result.error.message.match(/column clienti\.([a-zA-Z0-9_]+) does not exist/)?.[1]
      if (!missingColumn || !columns.includes(missingColumn)) {
        throw new Error(`clienti: ${result.error.message}`)
      }
      columns = columns.filter((column) => column !== missingColumn)
    }
    for (const row of ((data ?? []) as unknown as ClienteCrmRecord[])) {
      if (row.zoho_record_id) clienti.set(normalizeZohoId(row.zoho_record_id), row)
    }
  })
  return clienti
}

async function selectExistingByZohoRecordId<T extends { zoho_record_id: string | null }>(
  supabase: SupabaseLike,
  table: "clienti" | "compiti",
  columns: readonly string[],
  zohoIds: string[],
): Promise<Map<string, T>> {
  const records = new Map<string, T>()
  const uniqueIds = [...new Set(zohoIds.filter(Boolean))]
  await inChunks(uniqueIds, async (chunk) => {
    let selectColumns: string[] = [...columns]
    let data: unknown[] | null = null
    for (;;) {
      const result = await supabase
        .from(table)
        .select(selectColumns.join(","))
        .in("zoho_record_id", chunk)
      if (!result.error) {
        data = (result.data ?? []) as unknown[]
        break
      }

      const missingColumn = result.error.message.match(/column [a-z_]+\.([a-zA-Z0-9_]+) does not exist/)?.[1]
      if (!missingColumn || !selectColumns.includes(missingColumn)) {
        throw new Error(`${table}: ${result.error.message}`)
      }
      selectColumns = selectColumns.filter((column) => column !== missingColumn)
    }
    for (const row of ((data ?? []) as unknown as T[])) {
      if (row.zoho_record_id) records.set(String(row.zoho_record_id), row)
    }
  })
  return records
}

export async function fetchCompitiByZohoRecordId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, CompitoCrmRecord>> {
  const lookupIds = [
    ...new Set(zohoIds.flatMap((id) => (id ? [id, `zcrm_${id}`] : []))),
  ]
  const records = await selectExistingByZohoRecordId<CompitoCrmRecord>(
    supabase,
    "compiti",
    COMPITI_CRM_SELECT_COLUMNS,
    lookupIds,
  )
  return new Map([...records.values()].map((record) => [
    normalizeZohoId(record.zoho_record_id),
    record,
  ]))
}

export async function createSyncRun(
  supabase: SupabaseLike,
  params: { mode: ZohoSyncMode; modules: ZohoSyncModule[]; since?: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from("zoho_sync_runs")
    .insert({
      mode: params.mode,
      status: "running",
      modules: params.modules,
      since: params.since ?? null,
    })
    .select("id")
    .single()
  if (error) throw new Error(`zoho_sync_runs insert: ${error.message}`)
  return String(data.id)
}

export async function finishSyncRun(
  supabase: SupabaseLike,
  runId: string,
  params: { status: ZohoSyncStatus; stats?: ZohoSyncStats; error?: string | null },
) {
  const { error } = await supabase
    .from("zoho_sync_runs")
    .update({
      status: params.status,
      finished_at: new Date().toISOString(),
      stats: params.stats ?? null,
      error: params.error ?? null,
    })
    .eq("id", runId)
  if (error) throw new Error(`zoho_sync_runs update: ${error.message}`)
}

function eventPayload(runId: string, module: ZohoSyncModule, event: SyncDiffResult) {
  return {
    run_id: runId,
    module,
    zoho_id: event.zohoId,
    crm_record_id: event.crmRecordId,
    action: event.action,
    payload_summary: {
      ...event.payloadSummary,
      diffCount: event.diffs.length,
    },
    error: event.error,
  }
}

function conflictPayload(module: ZohoSyncModule, event: SyncDiffResult, diff: FieldDiff) {
  return {
    module,
    zoho_id: event.zohoId,
    crm_record_id: event.crmRecordId,
    field: diff.field,
    crm_value: diff.crmValue === null ? null : String(diff.crmValue),
    zoho_value: diff.zohoValue === null ? null : String(diff.zohoValue),
    status: "open",
  }
}

export async function insertSyncEvents(
  supabase: SupabaseLike,
  runId: string,
  module: ZohoSyncModule,
  events: SyncDiffResult[],
) {
  await inChunks(events.map((event) => eventPayload(runId, module, event)), async (chunk) => {
    const { error } = await supabase.from("zoho_sync_events").insert(chunk)
    if (error) throw new Error(`zoho_sync_events insert: ${error.message}`)
  })

  const conflicts = events
    .filter((event) => event.action === "conflict")
    .flatMap((event) => event.diffs.map((diff) => conflictPayload(module, event, diff)))
  if (conflicts.length === 0) return

  await inChunks(conflicts, async (chunk) => {
    const { error } = await supabase.from("zoho_sync_conflicts").insert(chunk)
    if (error) throw new Error(`zoho_sync_conflicts insert: ${error.message}`)
  })
}
