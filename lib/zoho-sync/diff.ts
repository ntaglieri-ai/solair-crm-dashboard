import { updateableMappedColumns } from "./mapping"
import { valuesEqual } from "./normalizers"
import type { FieldDiff, LeadCrmRecord, LeadDiffResult, NormalizedLead } from "./types"

function summarize(
  lead: NormalizedLead,
  diffs: FieldDiff[],
): Record<string, unknown> {
  return {
    mappedValues: Object.entries(lead).filter(([, value]) => value !== null && value !== "").length,
    changedFields: diffs.map((diff) => diff.field),
  }
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

  const diffs: FieldDiff[] = []
  for (const field of updateableMappedColumns()) {
    const zohoValue = lead[field] ?? null
    const crmValue = existing[field] ?? null
    if (!valuesEqual(crmValue, zohoValue)) {
      diffs.push({ field, crmValue, zohoValue })
    }
  }

  if (diffs.length === 0) {
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
