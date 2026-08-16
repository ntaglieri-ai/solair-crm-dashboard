import { updateableClienteColumns, type ClienteCrmRecord, type NormalizedCliente } from "./clienti-mapping"
import { updateableCompitoColumns, type CompitoCrmRecord, type NormalizedCompito } from "./compiti-mapping"
import { updateableInstallatoreColumns, type InstallatoreCrmRecord, type NormalizedInstallatore } from "./installatori-mapping"
import { updateableMappedColumns } from "./mapping"
import { valuesEqual, zohoIdValuesEqual } from "./normalizers"
import { updateableScadenzaColumns, type NormalizedScadenza, type ScadenzaCrmRecord } from "./scadenze-mapping"
import type { FieldDiff, LeadCrmRecord, LeadDiffResult, NormalizedLead, SyncDiffResult } from "./types"

function summarize(
  record: Record<string, unknown>,
  diffs: FieldDiff[],
): Record<string, unknown> {
  const writableFields = writableDiffs(diffs).map((diff) => diff.field)
  const blockedEmptyZohoFields = diffs
    .filter((diff) => diff.writeBlockedReason === "empty_zoho_preserves_crm")
    .map((diff) => diff.field)
  return {
    mappedValues: Object.entries(record).filter(([, value]) => value !== null && value !== "").length,
    changedFields: diffs.map((diff) => diff.field),
    writableFields,
    blockedEmptyZohoFields,
  }
}

function diffExistingRecord(params: {
  normalized: Record<string, unknown>
  existing: Record<string, unknown>
  columns: string[]
}): FieldDiff[] {
  const diffs: FieldDiff[] = []
  for (const field of params.columns) {
    const zohoValue = (params.normalized[field] ?? null) as FieldDiff["zohoValue"]
    const crmValue = (params.existing[field] ?? null) as FieldDiff["crmValue"]
    if (!fieldValuesEqual(field, crmValue, zohoValue)) {
      diffs.push({
        field,
        crmValue,
        zohoValue,
        writeBlockedReason: shouldPreserveExistingCrmValue(crmValue, zohoValue)
          ? "empty_zoho_preserves_crm"
          : undefined,
      })
    }
  }
  return diffs
}

function isEmptySyncValue(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}

function shouldPreserveExistingCrmValue(crmValue: unknown, zohoValue: unknown): boolean {
  return isEmptySyncValue(zohoValue) && !isEmptySyncValue(crmValue)
}

export function writableDiffs(diffs: FieldDiff[]): FieldDiff[] {
  return diffs.filter((diff) => !diff.writeBlockedReason)
}

export function buildUpdatePayload(
  normalized: Record<string, unknown>,
  diffs: FieldDiff[],
): Record<string, unknown> {
  return Object.fromEntries(
    writableDiffs(diffs).map((diff) => [diff.field, normalized[diff.field] ?? null]),
  )
}

function hasWritableDiffs(diffs: FieldDiff[]): boolean {
  return writableDiffs(diffs).length > 0
}

function isZohoIdField(field: string): boolean {
  return field === "zoho_id" || field === "zoho_record_id" || field.endsWith("_zoho_id") || /^zoho_.*_id$/.test(field)
}

function fieldValuesEqual(field: string, crmValue: unknown, zohoValue: unknown): boolean {
  if (isZohoIdField(field)) return zohoIdValuesEqual(crmValue, zohoValue)
  return valuesEqual(crmValue, zohoValue)
}

export function diffLeadRecord(
  lead: NormalizedLead,
  existing: LeadCrmRecord | null,
): LeadDiffResult {
  if (!existing) {
    return {
      action: "create",
      zohoId: lead.zoho_id,
      crmRecordId: null,
      diffs: [],
      error: null,
      payloadSummary: {
        mappedValues: Object.entries(lead).filter(([, value]) => value !== null && value !== "").length,
      },
    }
  }

  const diffs = diffExistingRecord({
    normalized: lead,
    existing,
    columns: updateableMappedColumns(),
  })

  if (!hasWritableDiffs(diffs)) {
    return {
      action: "skip",
      zohoId: lead.zoho_id,
      crmRecordId: existing.id,
      diffs,
      error: null,
      payloadSummary: summarize(lead, diffs),
    }
  }

  return {
    action: "update",
    zohoId: lead.zoho_id,
    crmRecordId: existing.id,
    diffs,
    error: null,
    payloadSummary: summarize(lead, diffs),
  }
}

export function diffClienteRecord(
  cliente: NormalizedCliente,
  existing: ClienteCrmRecord | null,
): SyncDiffResult {
  if (!existing) {
    return {
      action: "create",
      zohoId: cliente.zoho_record_id,
      crmRecordId: null,
      diffs: [],
      error: null,
      payloadSummary: {
        mappedValues: Object.entries(cliente).filter(([, value]) => value !== null && value !== "").length,
      },
    }
  }

  const diffs = diffExistingRecord({
    normalized: cliente,
    existing,
    columns: updateableClienteColumns(),
  })

  if (!hasWritableDiffs(diffs)) {
    return {
      action: "skip",
      zohoId: cliente.zoho_record_id,
      crmRecordId: existing.id,
      diffs,
      error: null,
      payloadSummary: summarize(cliente, diffs),
    }
  }

  return {
    action: "update",
    zohoId: cliente.zoho_record_id,
    crmRecordId: existing.id,
    diffs,
    error: null,
    payloadSummary: summarize(cliente, diffs),
  }
}

export function diffCompitoRecord(
  compito: NormalizedCompito,
  existing: CompitoCrmRecord | null,
): SyncDiffResult {
  if (!existing) {
    return {
      action: "create",
      zohoId: compito.zoho_record_id,
      crmRecordId: null,
      diffs: [],
      error: null,
      payloadSummary: {
        mappedValues: Object.entries(compito).filter(([, value]) => value !== null && value !== "").length,
      },
    }
  }

  const diffs = diffExistingRecord({
    normalized: compito,
    existing,
    columns: updateableCompitoColumns(),
  })

  if (!hasWritableDiffs(diffs)) {
    return {
      action: "skip",
      zohoId: compito.zoho_record_id,
      crmRecordId: existing.id,
      diffs,
      error: null,
      payloadSummary: summarize(compito, diffs),
    }
  }

  return {
    action: "update",
    zohoId: compito.zoho_record_id,
    crmRecordId: existing.id,
    diffs,
    error: null,
    payloadSummary: summarize(compito, diffs),
  }
}

export function diffScadenzaRecord(
  scadenza: NormalizedScadenza,
  existing: ScadenzaCrmRecord | null,
): SyncDiffResult {
  if (!existing) {
    return {
      action: "create",
      zohoId: scadenza.zoho_id,
      crmRecordId: null,
      diffs: [],
      error: null,
      payloadSummary: {
        mappedValues: Object.entries(scadenza).filter(([, value]) => value !== null && value !== "").length,
      },
    }
  }

  const diffs = diffExistingRecord({
    normalized: scadenza,
    existing,
    columns: updateableScadenzaColumns(),
  })

  if (!hasWritableDiffs(diffs)) {
    return {
      action: "skip",
      zohoId: scadenza.zoho_id,
      crmRecordId: existing.id,
      diffs,
      error: null,
      payloadSummary: summarize(scadenza, diffs),
    }
  }

  return {
    action: "update",
    zohoId: scadenza.zoho_id,
    crmRecordId: existing.id,
    diffs,
    error: null,
    payloadSummary: summarize(scadenza, diffs),
  }
}

export function diffInstallatoreRecord(
  installatore: NormalizedInstallatore,
  existing: InstallatoreCrmRecord | null,
): SyncDiffResult {
  if (!existing) {
    return {
      action: "create",
      zohoId: installatore.zoho_id,
      crmRecordId: null,
      diffs: [],
      error: null,
      payloadSummary: {
        mappedValues: Object.entries(installatore).filter(([, value]) => value !== null && value !== "").length,
      },
    }
  }

  const diffs = diffExistingRecord({
    normalized: installatore,
    existing,
    columns: updateableInstallatoreColumns(),
  })

  if (!hasWritableDiffs(diffs)) {
    return {
      action: "skip",
      zohoId: installatore.zoho_id,
      crmRecordId: existing.id,
      diffs,
      error: null,
      payloadSummary: summarize(installatore, diffs),
    }
  }

  return {
    action: "update",
    zohoId: installatore.zoho_id,
    crmRecordId: existing.id,
    diffs,
    error: null,
    payloadSummary: summarize(installatore, diffs),
  }
}

export function errorResult(
  message: string,
  zohoId: string | null,
  rowNumber?: number,
): LeadDiffResult {
  return {
    action: "error",
    zohoId,
    crmRecordId: null,
    diffs: [],
    error: message,
    payloadSummary: { rowNumber },
  }
}
