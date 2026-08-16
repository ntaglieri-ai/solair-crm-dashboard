import {
  normalizeZohoId,
  nullableText,
  timestampValue,
} from "./normalizers"
import type { CsvRow, SyncValue } from "./types"

export const INSTALLATORE_ZOHO_ID_HEADER = "ID record"
export const INSTALLATORE_OWNER_ZOHO_ID_HEADER = "Proprietario di Installatore.id"

type InstallatoreFieldType = "text" | "timestamp" | "zoho_id"

type InstallatoreZohoMapping = {
  csvHeader: string
  column: string
  type: InstallatoreFieldType
  updateExisting: boolean
}

export type NormalizedInstallatore = Record<string, SyncValue> & {
  zoho_id: string
}

export type InstallatoreCrmRecord = Record<string, SyncValue | undefined> & {
  id: string
  zoho_id: string | null
  zoho_synced_at: string | null
}

export const IGNORED_INSTALLATORI_HEADERS = [
  "Proprietario di Installatore.id",
  "Proprietario di Installatore",
  "Creato da.id",
  "Creato da",
  "Modificato da.id",
  "Modificato da",
  "Ora modifica",
  "Ora ultima attività",
  "Opt-out e-mail",
  "Modalità iscrizione annullata",
  "Ora  iscrizione annullata",
  "Locked",
  "Connected To.module",
  "Connesso a.id",
] as const

export const INSTALLATORI_ZOHO_MAPPINGS = [
  { csvHeader: "ID record", column: "zoho_id", type: "zoho_id", updateExisting: false },
  { csvHeader: "Nome Installatore", column: "nome", type: "text", updateExisting: true },
  { csvHeader: "E-mail", column: "email", type: "text", updateExisting: true },
  { csvHeader: "E-mail secondaria", column: "email_secondaria", type: "text", updateExisting: true },
  { csvHeader: "Ora creazione", column: "created_at", type: "timestamp", updateExisting: false },
  { csvHeader: "Tag", column: "tag", type: "text", updateExisting: true },
  { csvHeader: "Telefono", column: "telefono", type: "text", updateExisting: true },
  {
    csvHeader: "Orario del registro delle modifiche",
    column: "zoho_modified_at",
    type: "timestamp",
    updateExisting: true,
  },
] as const satisfies readonly InstallatoreZohoMapping[]

export const INSTALLATORI_MAPPED_COLUMNS = INSTALLATORI_ZOHO_MAPPINGS.map((field) => field.column)
export const INSTALLATORI_UPDATE_COLUMNS = INSTALLATORI_ZOHO_MAPPINGS
  .filter((field) => field.updateExisting)
  .map((field) => field.column)

export const INSTALLATORI_CRM_SELECT_COLUMNS = [
  "id",
  "zoho_synced_at",
  ...INSTALLATORI_MAPPED_COLUMNS,
  "proprietario_id",
] as const

const mappedHeaderSet = new Set<string>(INSTALLATORI_ZOHO_MAPPINGS.map((field) => field.csvHeader))
const ignoredHeaderSet = new Set<string>(IGNORED_INSTALLATORI_HEADERS)

export function unmappedInstallatoriHeaders(headers: string[]): string[] {
  return headers.filter((header) => !mappedHeaderSet.has(header) && !ignoredHeaderSet.has(header))
}

function normalizeByType(value: unknown, type: InstallatoreFieldType): SyncValue {
  if (type === "timestamp") return timestampValue(value)
  if (type === "zoho_id") return normalizeZohoId(value) || null
  return nullableText(value)
}

export function normalizeInstallatoreCsvRow(
  row: CsvRow,
  ownerIdsByZohoId: Map<string, string>,
): NormalizedInstallatore | null {
  const zohoId = normalizeZohoId(row[INSTALLATORE_ZOHO_ID_HEADER])
  if (!zohoId) return null

  const normalized: NormalizedInstallatore = { zoho_id: zohoId }
  for (const field of INSTALLATORI_ZOHO_MAPPINGS) {
    if (field.column === "zoho_id") continue
    normalized[field.column] = normalizeByType(row[field.csvHeader], field.type)
  }

  const ownerZohoId = normalizeZohoId(row[INSTALLATORE_OWNER_ZOHO_ID_HEADER])
  normalized.proprietario_id = ownerIdsByZohoId.get(ownerZohoId) ?? null
  return normalized
}

export function updateableInstallatoreColumns(): string[] {
  return [...INSTALLATORI_UPDATE_COLUMNS, "proprietario_id"]
}
