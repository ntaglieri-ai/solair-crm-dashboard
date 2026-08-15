import { LEAD_CRM_SELECT_COLUMNS } from "./mapping"
import type {
  FieldDiff,
  LeadCrmRecord,
  LeadDiffResult,
  SupabaseLike,
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

export async function fetchLeadsByZohoId(
  supabase: SupabaseLike,
  zohoIds: string[],
): Promise<Map<string, LeadCrmRecord>> {
  const leads = new Map<string, LeadCrmRecord>()
  const uniqueIds = [...new Set(zohoIds.filter(Boolean))]
  await inChunks(uniqueIds, async (chunk) => {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_CRM_SELECT_COLUMNS.join(","))
      .in("zoho_id", chunk)
    if (error) throw new Error(`leads: ${error.message}`)
    for (const row of ((data ?? []) as unknown as LeadCrmRecord[])) {
      if (row.zoho_id) leads.set(String(row.zoho_id), row as LeadCrmRecord)
    }
  })
  return leads
}

export async function createSyncRun(
  supabase: SupabaseLike,
  params: { mode: ZohoSyncMode; modules: string[]; since?: string | null },
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

function eventPayload(runId: string, event: LeadDiffResult) {
  return {
    run_id: runId,
    module: "leads",
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

function conflictPayload(event: LeadDiffResult, diff: FieldDiff) {
  return {
    module: "leads",
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
  events: LeadDiffResult[],
) {
  await inChunks(events.map((event) => eventPayload(runId, event)), async (chunk) => {
    const { error } = await supabase.from("zoho_sync_events").insert(chunk)
    if (error) throw new Error(`zoho_sync_events insert: ${error.message}`)
  })

  const conflicts = events
    .filter((event) => event.action === "conflict")
    .flatMap((event) => event.diffs.map((diff) => conflictPayload(event, diff)))
  if (conflicts.length === 0) return

  await inChunks(conflicts, async (chunk) => {
    const { error } = await supabase.from("zoho_sync_conflicts").insert(chunk)
    if (error) throw new Error(`zoho_sync_conflicts insert: ${error.message}`)
  })
}
