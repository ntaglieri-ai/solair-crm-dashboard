import {
  booleanValue,
  normalizeZohoId,
  nullableText,
  timestampValue,
} from "./normalizers"
import type { CsvRow, SyncValue } from "./types"

export const COMPITO_ZOHO_ID_HEADER = "ID record"
export const COMPITO_OWNER_ZOHO_ID_HEADER = "Proprietario del compito.id"

type CompitoFieldType = "text" | "timestamp" | "boolean" | "zoho_id"

type CompitoZohoMapping = {
  csvHeader: string
  column: string
  type: CompitoFieldType
  updateExisting: boolean
}

export type NormalizedCompito = Record<string, SyncValue> & {
  zoho_record_id: string
}

export type CompitoCrmRecord = Record<string, SyncValue | undefined> & {
  id: string
  zoho_record_id: string | null
  zoho_synced_at: string | null
}

export const COMPITI_ZOHO_MAPPINGS = [
  { csvHeader: "ID record", column: "zoho_record_id", type: "zoho_id", updateExisting: false },
  { csvHeader: "Proprietario del compito.id", column: "proprietario_zoho_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Proprietario del compito", column: "proprietario_nome", type: "text", updateExisting: true },
  { csvHeader: "Oggetto", column: "oggetto", type: "text", updateExisting: true },
  { csvHeader: "Data di scadenza", column: "scadenza", type: "timestamp", updateExisting: true },
  { csvHeader: "Nome contatto.id", column: "nome_contatto_zoho_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Nome contatto", column: "nome_contatto", type: "text", updateExisting: true },
  { csvHeader: "Correlato a.id", column: "correlato_zoho_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Correlato a", column: "correlato_nome", type: "text", updateExisting: true },
  { csvHeader: "Stato", column: "stato", type: "text", updateExisting: true },
  { csvHeader: "Priorità", column: "priorita", type: "text", updateExisting: true },
  { csvHeader: "Ripeti", column: "ripeti", type: "text", updateExisting: true },
  { csvHeader: "Promemoria", column: "promemoria", type: "timestamp", updateExisting: true },
  { csvHeader: "Creato da.id", column: "creato_da_zoho_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Creato da", column: "creato_da_nome", type: "text", updateExisting: true },
  { csvHeader: "Modificato da.id", column: "modificato_da_zoho_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Modificato da", column: "modificato_da_nome", type: "text", updateExisting: true },
  { csvHeader: "Ora creazione", column: "ora_creazione", type: "timestamp", updateExisting: true },
  { csvHeader: "Ora modifica", column: "ora_modifica", type: "timestamp", updateExisting: true },
  { csvHeader: "Descrizione", column: "descrizione", type: "text", updateExisting: true },
  { csvHeader: "Orario di chiusura", column: "orario_chiusura", type: "timestamp", updateExisting: true },
  { csvHeader: "Tag", column: "tag", type: "text", updateExisting: true },
  { csvHeader: "Locked", column: "locked", type: "boolean", updateExisting: true },
  { csvHeader: "Ora ultima attività", column: "ora_ultima_attivita", type: "timestamp", updateExisting: true },
  { csvHeader: "Orario del registro delle modifiche", column: "zoho_modified_at", type: "timestamp", updateExisting: true },
] as const satisfies readonly CompitoZohoMapping[]

export const COMPITI_MAPPED_COLUMNS = COMPITI_ZOHO_MAPPINGS.map((field) => field.column)
export const COMPITI_UPDATE_COLUMNS = COMPITI_ZOHO_MAPPINGS
  .filter((field) => field.updateExisting)
  .map((field) => field.column)

export const COMPITI_CRM_SELECT_COLUMNS = [
  "id",
  "zoho_synced_at",
  ...COMPITI_MAPPED_COLUMNS,
  "proprietario_id",
] as const

const mappedHeaderSet = new Set<string>(COMPITI_ZOHO_MAPPINGS.map((field) => field.csvHeader))

export function unmappedCompitiHeaders(headers: string[]): string[] {
  return headers.filter((header) => !mappedHeaderSet.has(header))
}

function normalizeByType(value: unknown, type: CompitoFieldType): SyncValue {
  if (type === "boolean") return booleanValue(value)
  if (type === "timestamp") return timestampValue(value)
  if (type === "zoho_id") return normalizeZohoId(value) || null
  return nullableText(value)
}

export function normalizeCompitoCsvRow(
  row: CsvRow,
  ownerIdsByZohoId: Map<string, string>,
): NormalizedCompito | null {
  const zohoId = normalizeZohoId(row[COMPITO_ZOHO_ID_HEADER])
  if (!zohoId) return null

  const normalized: NormalizedCompito = { zoho_record_id: zohoId }
  for (const field of COMPITI_ZOHO_MAPPINGS) {
    if (field.column === "zoho_record_id") continue
    normalized[field.column] = normalizeByType(row[field.csvHeader], field.type)
  }

  const ownerZohoId = normalizeZohoId(row[COMPITO_OWNER_ZOHO_ID_HEADER])
  normalized.proprietario_id = ownerIdsByZohoId.get(ownerZohoId) ?? null
  return normalized
}

export function updateableCompitoColumns(): string[] {
  return [...COMPITI_UPDATE_COLUMNS, "proprietario_id"]
}
