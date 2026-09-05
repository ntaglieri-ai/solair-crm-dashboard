import type { CsvRow, LeadColumn, LeadZohoMapping, NormalizedLead } from "./types"
import {
  booleanValue,
  normalizeZohoId,
  nullableText,
  numberValue,
  timestampValue,
} from "./normalizers"

export const LEAD_ZOHO_ID_HEADER = "ID record"
export const LEAD_OWNER_ZOHO_ID_HEADER = "Lead Proprietario.id"

export const IGNORED_LEAD_HEADERS = [
  "Tag",
  "Lead Proprietario",
  "Account convertito",
  "Data/ora convertita",
  "Ora dell’ultimo arricchimento",
  "Ora dell'ultimo arricchimento",
  "Stato arricchito",
] as const

export const LEAD_ZOHO_MAPPINGS = [
  { csvHeader: "ID record", column: "zoho_id", type: "zoho_id", updateExisting: false },
  { csvHeader: "Lead Proprietario.id", column: "zoho_owner_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Nome", column: "nome", type: "text", updateExisting: true },
  { csvHeader: "Cognome", column: "cognome", type: "text", updateExisting: true },
  { csvHeader: "Lead Name", column: "nome_lead", type: "text", updateExisting: true },
  { csvHeader: "E-mail", column: "email", type: "text", updateExisting: true },
  { csvHeader: "Telefono", column: "telefono", type: "text", updateExisting: true },
  { csvHeader: "Origine Lead", column: "origine_lead", type: "text", updateExisting: true },
  { csvHeader: "Stato Lead", column: "stato_lead", type: "text", updateExisting: true },
  { csvHeader: "Creato da.id", column: "zoho_creato_da_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Creato da", column: "creato_da", type: "text", updateExisting: true },
  { csvHeader: "Ora creazione", column: "created_at", type: "timestamp", updateExisting: false },
  { csvHeader: "Saluti", column: "saluti", type: "text", updateExisting: true },
  { csvHeader: "Ora ultima attività", column: "ora_ultima_attivita", type: "timestamp", updateExisting: true },
  { csvHeader: "Città", column: "citta", type: "text", updateExisting: true },
  { csvHeader: "Provincia", column: "provincia", type: "text", updateExisting: true },
  { csvHeader: "Codice postale", column: "codice_postale", type: "text", updateExisting: true },
  { csvHeader: "Paese", column: "paese", type: "text", updateExisting: true },
  { csvHeader: "Descrizione", column: "descrizione", type: "text", updateExisting: true },
  { csvHeader: "Valutazione", column: "valutazione", type: "number", updateExisting: true },
  { csvHeader: "Account convertito.id", column: "zoho_account_convertito_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Contatto convertito.id", column: "zoho_contatto_convertito_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Contatto convertito", column: "contatto_convertito", type: "text", updateExisting: true },
  { csvHeader: "Orario del registro delle modifiche", column: "zoho_modified_at", type: "timestamp", updateExisting: true },
  { csvHeader: "è convertito", column: "convertito", type: "boolean", updateExisting: true },
  { csvHeader: "Locked", column: "bloccato", type: "boolean", updateExisting: true },
  { csvHeader: "Residente in Sicilia", column: "residente_in_sicilia", type: "boolean", updateExisting: true },
  { csvHeader: "campaign name", column: "campaign_name", type: "text", updateExisting: true },
  { csvHeader: "Mobile/Fisso", column: "mobile_fisso", type: "text", updateExisting: true },
  { csvHeader: "Stato", column: "stato_email", type: "text", updateExisting: true },
  { csvHeader: "Social Lead ID", column: "social_lead_id", type: "text", updateExisting: true },
  { csvHeader: "Data sopralluogo", column: "data_sopralluogo", type: "timestamp", updateExisting: true },
  {
    csvHeader: "Installatore - Incaricato sopralluogo",
    column: "zoho_installatore_sopralluogo_nome",
    type: "text",
    updateExisting: true,
  },
  {
    csvHeader: "Installatore - Incaricato sopralluogo.id",
    column: "zoho_installatore_sopralluogo_id",
    type: "zoho_id",
    updateExisting: true,
  },
  { csvHeader: "Connected To.module", column: "connesso_a", type: "text", updateExisting: true },
  { csvHeader: "Connesso a.id", column: "zoho_connesso_a_id", type: "zoho_id", updateExisting: true },
  { csvHeader: "Data Click", column: "data_click", type: "timestamp", updateExisting: true },
  { csvHeader: "Data/Ora", column: "data_ora", type: "timestamp", updateExisting: true },
  { csvHeader: "Tempo di conversione Lead", column: "tempo_conversione_lead", type: "text", updateExisting: true },
  { csvHeader: "Modalità iscrizione annullata", column: "modalita_iscrizione_annullata", type: "text", updateExisting: true },
  { csvHeader: "Ora  iscrizione annullata", column: "ora_iscrizione_annullata", type: "timestamp", updateExisting: true },
] as const satisfies readonly LeadZohoMapping[]

export const LEAD_MAPPED_COLUMNS = LEAD_ZOHO_MAPPINGS.map((field) => field.column)
export const LEAD_UPDATE_COLUMNS = LEAD_ZOHO_MAPPINGS
  .filter((field) => field.updateExisting)
  .map((field) => field.column)

export const LEAD_CRM_SELECT_COLUMNS = [
  "id",
  "zoho_synced_at",
  ...LEAD_MAPPED_COLUMNS,
  "lead_proprietario_id",
] as const

const mappedHeaderSet = new Set<string>(LEAD_ZOHO_MAPPINGS.map((field) => field.csvHeader))
const ignoredHeaderSet = new Set<string>(IGNORED_LEAD_HEADERS)

export function unmappedHeaders(headers: string[]): string[] {
  return headers.filter((header) => !mappedHeaderSet.has(header) && !ignoredHeaderSet.has(header))
}

function normalizeByType(value: unknown, type: LeadZohoMapping["type"]) {
  if (type === "boolean") return booleanValue(value)
  if (type === "number") return numberValue(value)
  if (type === "timestamp") return timestampValue(value)
  if (type === "zoho_id") return normalizeZohoId(value) || null
  return nullableText(value)
}

export function normalizeLeadCsvRow(
  row: CsvRow,
  ownerIdsByZohoId: Map<string, string>,
): NormalizedLead | null {
  const zohoId = normalizeZohoId(row[LEAD_ZOHO_ID_HEADER])
  if (!zohoId) return null

  const normalized: NormalizedLead = { zoho_id: zohoId }
  for (const field of LEAD_ZOHO_MAPPINGS) {
    if (field.column === "zoho_id") continue
    normalized[field.column] = normalizeByType(row[field.csvHeader], field.type)
  }

  const ownerZohoId = normalizeZohoId(row[LEAD_OWNER_ZOHO_ID_HEADER])
  normalized.zoho_owner_id = ownerZohoId || null
  normalized.lead_proprietario_id = ownerIdsByZohoId.get(ownerZohoId) ?? null
  return normalized
}

export function updateableMappedColumns(): LeadColumn[] {
  return [...LEAD_UPDATE_COLUMNS, "lead_proprietario_id"]
}
