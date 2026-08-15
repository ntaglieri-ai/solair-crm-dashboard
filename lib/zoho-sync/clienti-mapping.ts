import {
  CLIENTI_ZOHO_COLUMNS,
  CLIENTI_ZOHO_FIELDS,
  type ClienteZohoFieldType,
} from "../clienti/zoho-fields"
import {
  booleanValue,
  normalizeZohoId,
  nullableText,
  numberValue,
  timestampValue,
} from "./normalizers"
import type { CsvRow, SyncValue } from "./types"

export const CLIENTE_ZOHO_ID_HEADER = "ID record"
export const CLIENTE_OWNER_ZOHO_ID_HEADER = "Clienti Proprietario.id"
export const CLIENTE_INSTALLATORE_ZOHO_ID_HEADER = "Installatore.id"

export type NormalizedCliente = Record<string, SyncValue> & {
  zoho_record_id: string
}

export type ClienteCrmRecord = Record<string, SyncValue | undefined> & {
  id: string
  zoho_record_id: string | null
  zoho_synced_at: string | null
}

const mappedHeaderSet = new Set<string>(CLIENTI_ZOHO_FIELDS.map((field) => field.zoho))

export const CLIENTI_CRM_SELECT_COLUMNS = [
  "id",
  "zoho_synced_at",
  ...CLIENTI_ZOHO_COLUMNS,
  "clienti_proprietario_id",
  "installatore_id",
] as const

export function unmappedClientiHeaders(headers: string[]): string[] {
  return headers.filter((header) => !mappedHeaderSet.has(header))
}

function normalizeByType(value: unknown, type: ClienteZohoFieldType): SyncValue {
  if (type === "boolean") return booleanValue(value)
  if (type === "numeric") return numberValue(value)
  if (type === "timestamp") return timestampValue(value)
  return nullableText(value)
}

export function normalizeClienteCsvRow(
  row: CsvRow,
  ownerIdsByZohoId: Map<string, string>,
  installatoreIdsByZohoId: Map<string, string>,
): NormalizedCliente | null {
  const zohoId = normalizeZohoId(row[CLIENTE_ZOHO_ID_HEADER])
  if (!zohoId) return null

  const normalized: NormalizedCliente = { zoho_record_id: zohoId }
  for (const field of CLIENTI_ZOHO_FIELDS) {
    if (field.column === "zoho_record_id") continue
    if (field.column.endsWith("_zoho_id")) {
      normalized[field.column] = normalizeZohoId(row[field.zoho]) || null
      continue
    }
    normalized[field.column] = normalizeByType(row[field.zoho], field.type)
  }

  const ownerZohoId = normalizeZohoId(row[CLIENTE_OWNER_ZOHO_ID_HEADER])
  normalized.clienti_proprietario_id = ownerIdsByZohoId.get(ownerZohoId) ?? null

  const installatoreZohoId = normalizeZohoId(row[CLIENTE_INSTALLATORE_ZOHO_ID_HEADER])
  normalized.installatore_id = installatoreIdsByZohoId.get(installatoreZohoId) ?? null

  return normalized
}

export function updateableClienteColumns(): string[] {
  return [
    ...CLIENTI_ZOHO_COLUMNS.filter((column) => column !== "zoho_record_id"),
    "clienti_proprietario_id",
    "installatore_id",
  ]
}
