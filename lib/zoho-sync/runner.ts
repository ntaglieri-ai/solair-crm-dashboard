import { readFile } from "node:fs/promises"
import { parse } from "csv-parse/sync"
import {
  CLIENTE_INSTALLATORE_ZOHO_ID_HEADER,
  CLIENTE_OWNER_ZOHO_ID_HEADER,
  CLIENTE_ZOHO_ID_HEADER,
  normalizeClienteCsvRow,
  unmappedClientiHeaders,
} from "./clienti-mapping"
import { diffClienteRecord, diffLeadRecord, errorResult } from "./diff"
import {
  LEAD_OWNER_ZOHO_ID_HEADER,
  LEAD_ZOHO_ID_HEADER,
  normalizeLeadCsvRow,
  unmappedHeaders,
} from "./mapping"
import { normalizeZohoId } from "./normalizers"
import {
  createSyncRun,
  fetchClientiByZohoRecordId,
  fetchInstallatoreIdsByZohoId,
  fetchLeadsByZohoId,
  fetchOwnerIdsByZohoId,
  finishSyncRun,
  insertSyncEvents,
} from "./repository"
import type {
  CsvRow,
  LeadDiffResult,
  SyncDiffResult,
  SupabaseLike,
  ZohoSyncRunResult,
  ZohoSyncStats,
} from "./types"

export type RunLeadDryRunOptions = {
  csvPath: string
  supabase: SupabaseLike
  logToDatabase?: boolean
}

export type RunClientiDryRunOptions = RunLeadDryRunOptions

function readCsvRows(csvText: string): CsvRow[] {
  return parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRow[]
}

function emptyStats(csvRows: number, unmapped: string[]): ZohoSyncStats {
  return {
    csvRows,
    mappedRows: 0,
    create: 0,
    update: 0,
    skip: 0,
    conflict: 0,
    error: 0,
    duplicateZohoIds: 0,
    missingZohoIds: 0,
    unresolvedOwnerIds: [],
    unmappedHeaders: unmapped,
  }
}

function increment(stats: ZohoSyncStats, event: SyncDiffResult) {
  stats[event.action] += 1
}

function validateCsvIds(rows: CsvRow[], idHeader: string) {
  const seen = new Set<string>()
  const duplicateIds = new Set<string>()
  const validRows: Array<{ row: CsvRow; rowNumber: number; zohoId: string }> = []
  const errors: LeadDiffResult[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const zohoId = normalizeZohoId(row[idHeader])
    if (!zohoId) {
      errors.push(errorResult("Lead senza ID record", null, rowNumber))
      return
    }
    if (seen.has(zohoId)) {
      duplicateIds.add(zohoId)
      errors.push(errorResult(`ID Zoho duplicato nel CSV: ${zohoId}`, zohoId, rowNumber))
      return
    }
    seen.add(zohoId)
    validRows.push({ row, rowNumber, zohoId })
  })

  return { validRows, errors, duplicateIds }
}

export async function runLeadDryRun(
  options: RunLeadDryRunOptions,
): Promise<ZohoSyncRunResult> {
  const csvText = await readFile(options.csvPath, "utf8")
  const rows = readCsvRows(csvText)
  const headers = Object.keys(rows[0] ?? {})
  const stats = emptyStats(rows.length, unmappedHeaders(headers))
  const events: LeadDiffResult[] = []
  let runId: string | null = null

  try {
    if (options.logToDatabase !== false) {
      runId = await createSyncRun(options.supabase, {
        mode: "dry_run",
        modules: ["leads"],
      })
    }

    const { validRows, errors, duplicateIds } = validateCsvIds(rows, LEAD_ZOHO_ID_HEADER)
    stats.duplicateZohoIds = duplicateIds.size
    stats.missingZohoIds = errors.filter((event) => !event.zohoId).length
    events.push(...errors)

    const ownerIdsByZohoId = await fetchOwnerIdsByZohoId(options.supabase)
    const unresolvedOwnerIds = new Set<string>()
    for (const { row } of validRows) {
      const ownerZohoId = normalizeZohoId(row[LEAD_OWNER_ZOHO_ID_HEADER])
      if (ownerZohoId && !ownerIdsByZohoId.has(ownerZohoId)) unresolvedOwnerIds.add(ownerZohoId)
    }
    stats.unresolvedOwnerIds = [...unresolvedOwnerIds].sort()

    const leadsByZohoId = await fetchLeadsByZohoId(
      options.supabase,
      validRows.map((item) => item.zohoId),
    )

    for (const { row, rowNumber, zohoId } of validRows) {
      const normalized = normalizeLeadCsvRow(row, ownerIdsByZohoId)
      if (!normalized) {
        events.push(errorResult("Lead senza ID record", zohoId, rowNumber))
        continue
      }
      const existing = leadsByZohoId.get(normalized.zoho_id) ?? null
      events.push(diffLeadRecord(normalized, existing))
      stats.mappedRows += 1
    }

    for (const event of events) increment(stats, event)

    if (runId) {
      await insertSyncEvents(options.supabase, runId, "leads", events)
      await finishSyncRun(options.supabase, runId, { status: "completed", stats })
    }

    return { runId, stats, events }
  } catch (error) {
    if (runId) {
      await finishSyncRun(options.supabase, runId, {
        status: "failed",
        stats,
        error: error instanceof Error ? error.message : "Errore sync Zoho",
      })
    }
    throw error
  }
}

export async function runClientiDryRun(
  options: RunClientiDryRunOptions,
): Promise<ZohoSyncRunResult> {
  const csvText = await readFile(options.csvPath, "utf8")
  const rows = readCsvRows(csvText)
  const headers = Object.keys(rows[0] ?? {})
  const stats = emptyStats(rows.length, unmappedClientiHeaders(headers))
  const events: SyncDiffResult[] = []
  let runId: string | null = null

  try {
    if (options.logToDatabase !== false) {
      runId = await createSyncRun(options.supabase, {
        mode: "dry_run",
        modules: ["clienti"],
      })
    }

    const { validRows, errors, duplicateIds } = validateCsvIds(rows, CLIENTE_ZOHO_ID_HEADER)
    stats.duplicateZohoIds = duplicateIds.size
    stats.missingZohoIds = errors.filter((event) => !event.zohoId).length
    events.push(...errors)

    const [ownerIdsByZohoId, installatoreIdsByZohoId] = await Promise.all([
      fetchOwnerIdsByZohoId(options.supabase),
      fetchInstallatoreIdsByZohoId(options.supabase),
    ])

    const unresolvedOwnerIds = new Set<string>()
    const unresolvedInstallatoreIds = new Set<string>()
    for (const { row } of validRows) {
      const ownerZohoId = normalizeZohoId(row[CLIENTE_OWNER_ZOHO_ID_HEADER])
      if (ownerZohoId && !ownerIdsByZohoId.has(ownerZohoId)) unresolvedOwnerIds.add(ownerZohoId)

      const installatoreZohoId = normalizeZohoId(row[CLIENTE_INSTALLATORE_ZOHO_ID_HEADER])
      if (installatoreZohoId && !installatoreIdsByZohoId.has(installatoreZohoId)) {
        unresolvedInstallatoreIds.add(installatoreZohoId)
      }
    }
    stats.unresolvedOwnerIds = [...unresolvedOwnerIds].sort()
    stats.unresolvedInstallatoreIds = [...unresolvedInstallatoreIds].sort()

    const clientiByZohoId = await fetchClientiByZohoRecordId(
      options.supabase,
      validRows.map((item) => item.zohoId),
    )

    for (const { row, rowNumber, zohoId } of validRows) {
      const normalized = normalizeClienteCsvRow(row, ownerIdsByZohoId, installatoreIdsByZohoId)
      if (!normalized) {
        events.push(errorResult("Cliente senza ID record", zohoId, rowNumber))
        continue
      }
      const existing = clientiByZohoId.get(normalized.zoho_record_id) ?? null
      events.push(diffClienteRecord(normalized, existing))
      stats.mappedRows += 1
    }

    for (const event of events) increment(stats, event)

    if (runId) {
      await insertSyncEvents(options.supabase, runId, "clienti", events)
      await finishSyncRun(options.supabase, runId, { status: "completed", stats })
    }

    return { runId, stats, events }
  } catch (error) {
    if (runId) {
      await finishSyncRun(options.supabase, runId, {
        status: "failed",
        stats,
        error: error instanceof Error ? error.message : "Errore sync Zoho clienti",
      })
    }
    throw error
  }
}
