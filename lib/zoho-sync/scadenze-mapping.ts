import {
  normalizeZohoId,
  nullableText,
  timestampValue,
} from "./normalizers"
import type { CsvRow, SyncValue } from "./types"

export const SCADENZA_ZOHO_ID_HEADER = "ID record"
export const SCADENZA_OWNER_ZOHO_ID_HEADER = "Proprietario di Scadenze.id"

type ScadenzaFieldType = "text" | "timestamp" | "zoho_id"

type ScadenzaZohoMapping = {
  csvHeader: string
  column: string
  type: ScadenzaFieldType
  updateExisting: boolean
}

export type NormalizedScadenza = Record<string, SyncValue> & {
  zoho_id: string
}

export type ScadenzaCrmRecord = Record<string, SyncValue | undefined> & {
  id: string
  zoho_id: string | null
  zoho_synced_at: string | null
}

export const IGNORED_SCADENZE_HEADERS = [
  "Proprietario di Scadenze.id",
  "Ora modifica",
  "Ora ultima attività",
  "Modalità iscrizione annullata",
  "Ora  iscrizione annullata",
  "Locked",
  "Connected To.module",
  "Connesso a.id",
] as const

export const SCADENZE_ZOHO_MAPPINGS = [
  { csvHeader: "ID record", column: "zoho_id", type: "zoho_id", updateExisting: false },
  { csvHeader: "Nome Scadenze", column: "nome", type: "text", updateExisting: true },
  { csvHeader: "Proprietario di Scadenze", column: "proprietario_nome", type: "text", updateExisting: true },
  { csvHeader: "Data scadenza", column: "data_scadenza", type: "timestamp", updateExisting: true },
  { csvHeader: "Ora creazione", column: "created_at", type: "timestamp", updateExisting: false },
  { csvHeader: "Descrizione", column: "descrizione", type: "text", updateExisting: true },
  { csvHeader: "Tag", column: "tag", type: "text", updateExisting: true },
  {
    csvHeader: "Orario del registro delle modifiche",
    column: "zoho_modified_at",
    type: "timestamp",
    updateExisting: true,
  },
] as const satisfies readonly ScadenzaZohoMapping[]

export const SCADENZE_MAPPED_COLUMNS = SCADENZE_ZOHO_MAPPINGS.map((field) => field.column)
export const SCADENZE_UPDATE_COLUMNS = SCADENZE_ZOHO_MAPPINGS
  .filter((field) => field.updateExisting)
  .map((field) => field.column)

export const SCADENZE_CRM_SELECT_COLUMNS = [
  "id",
  "zoho_synced_at",
  ...SCADENZE_MAPPED_COLUMNS,
  "proprietario_id",
] as const

const mappedHeaderSet = new Set<string>(SCADENZE_ZOHO_MAPPINGS.map((field) => field.csvHeader))
const ignoredHeaderSet = new Set<string>(IGNORED_SCADENZE_HEADERS)

export function unmappedScadenzeHeaders(headers: string[]): string[] {
  return headers.filter((header) => !mappedHeaderSet.has(header) && !ignoredHeaderSet.has(header))
}

function normalizeByType(value: unknown, type: ScadenzaFieldType): SyncValue {
  if (type === "timestamp") return timestampValue(value)
  if (type === "zoho_id") return normalizeZohoId(value) || null
  return nullableText(value)
}

export function normalizeScadenzaCsvRow(
  row: CsvRow,
  ownerIdsByZohoId: Map<string, string>,
): NormalizedScadenza | null {
  const zohoId = normalizeZohoId(row[SCADENZA_ZOHO_ID_HEADER])
  if (!zohoId) return null

  const normalized: NormalizedScadenza = { zoho_id: zohoId }
  for (const field of SCADENZE_ZOHO_MAPPINGS) {
    if (field.column === "zoho_id") continue
    normalized[field.column] = normalizeByType(row[field.csvHeader], field.type)
  }

  const ownerZohoId = normalizeZohoId(row[SCADENZA_OWNER_ZOHO_ID_HEADER])
  normalized.proprietario_id = ownerIdsByZohoId.get(ownerZohoId) ?? null
  return normalized
}

export function updateableScadenzaColumns(): string[] {
  return [...SCADENZE_UPDATE_COLUMNS, "proprietario_id"]
}
