import {
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
  STATO_LEAD_ORDER,
} from "@/lib/mock-data"
import {
  option,
  uniqueOptions,
  type ColumnValueOption,
} from "@/lib/crm-settings/column-values"

export const LEAD_OPTION_COLUMNS = [
  "stato_lead",
  "origine_lead",
  "sede",
  "campaign_name",
  "stato_email",
  "saluti",
  "modalita_iscrizione_annullata",
  "modello_pannello",
] as const

export type LeadOptionColumn = (typeof LEAD_OPTION_COLUMNS)[number]

export const LEAD_STATO_EMAIL_OPTIONS = ["In corso", "negativo"] as const
export const LEAD_SALUTI_OPTIONS = ["Sig.", "Sig.ra", "Dr.", "Prof."] as const
export const LEAD_MODALITA_ISCRIZIONE_ANNULLATA_OPTIONS = [
  "Unsubscribe link",
  "Link Annulla iscrizione",
  "Manuale",
  "Modulo di consenso",
  "Zoho Campaigns",
] as const

export const LEAD_FIELD_OPTION_FALLBACKS: Record<LeadOptionColumn, ColumnValueOption[]> = {
  stato_lead: STATO_LEAD_ORDER.map((value) => option(value)),
  origine_lead: ORIGINE_LEAD_VALUES.map((value) => option(value)),
  sede: SEDE_LABELS.map((value) => option(value)),
  campaign_name: [],
  stato_email: LEAD_STATO_EMAIL_OPTIONS.map((value) => option(value)),
  saluti: LEAD_SALUTI_OPTIONS.map((value) => option(value)),
  modalita_iscrizione_annullata: LEAD_MODALITA_ISCRIZIONE_ANNULLATA_OPTIONS.map((value) =>
    option(value),
  ),
  modello_pannello: [],
}

export function isLeadOptionColumn(column: string): column is LeadOptionColumn {
  return (LEAD_OPTION_COLUMNS as readonly string[]).includes(column)
}

function looksLikeImportedGarbage(column: LeadOptionColumn, value: string) {
  if (column === "campaign_name" || column === "modello_pannello") return false
  if (/^\d{8,}$/.test(value)) return true
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return true
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) return true
  return false
}

export function cleanLeadOptionValue(column: LeadOptionColumn, value: unknown) {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text || text === "—") return null
  if (looksLikeImportedGarbage(column, text)) return null
  return text
}

export function mergeLeadOptions(
  column: LeadOptionColumn,
  configured: ColumnValueOption[],
  importedValues: string[],
) {
  return uniqueOptions([
    ...configured,
    ...importedValues.map((value) => option(value)),
    ...LEAD_FIELD_OPTION_FALLBACKS[column],
  ])
}
