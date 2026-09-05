import type { Lead } from "@/lib/mock-data"

export type LeadRecordFieldType = "text" | "numeric" | "boolean" | "timestamp"

export interface LeadRecordField {
  column: string
  type: LeadRecordFieldType
  appField: keyof Lead
}

export const LEAD_RECORD_FIELDS = [
  { column: "nome_lead", type: "text", appField: "Nome Lead" },
  { column: "nome", type: "text", appField: "Nome" },
  { column: "cognome", type: "text", appField: "Cognome" },
  { column: "email", type: "text", appField: "E-mail" },
  { column: "telefono", type: "text", appField: "Telefono" },
  { column: "mobile_fisso", type: "text", appField: "Mobile/Fisso" },
  { column: "social_lead_id", type: "text", appField: "Social Lead ID" },
  { column: "residente_in_sicilia", type: "boolean", appField: "Residente in Sicilia" },
  { column: "citta", type: "text", appField: "Città" },
  { column: "provincia", type: "text", appField: "Provincia" },
  { column: "codice_postale", type: "text", appField: "Codice postale" },
  { column: "paese", type: "text", appField: "Paese" },
  { column: "stato_lead", type: "text", appField: "Stato Lead" },
  { column: "stato_email", type: "text", appField: "Stato" },
  { column: "valutazione", type: "numeric", appField: "Valutazione" },
  { column: "lead_proprietario_id", type: "text", appField: "Lead Proprietario" },
  { column: "origine_lead", type: "text", appField: "Origine Lead" },
  { column: "sede", type: "text", appField: "Sede" },
  { column: "campaign_name", type: "text", appField: "campaign name" },
  { column: "kwp", type: "numeric", appField: "kWp" },
  { column: "kwh", type: "numeric", appField: "kWh" },
  { column: "modello_pannello", type: "text", appField: "Modello pannello" },
  { column: "wallbox_richiesto", type: "boolean", appField: "Wallbox richiesto" },
  { column: "consenso_contatto_telefono", type: "boolean", appField: "Consenso telefono" },
  { column: "consenso_contatto_whatsapp", type: "boolean", appField: "Consenso WhatsApp" },
  { column: "consenso_contatto_email", type: "boolean", appField: "Consenso e-mail" },
  { column: "data_sopralluogo", type: "timestamp", appField: "Data sopralluogo" },
  { column: "installatore_sopralluogo_id", type: "text", appField: "Installatore - Incaricato sopralluogo" },
  { column: "tempo_conversione_lead", type: "text", appField: "Tempo di conversione Lead" },
  { column: "account_convertito_id", type: "text", appField: "Account convertito" },
  { column: "contatto_convertito", type: "text", appField: "Contatto convertito" },
  { column: "modalita_iscrizione_annullata", type: "text", appField: "Modalità iscrizione annullata" },
  { column: "ora_iscrizione_annullata", type: "timestamp", appField: "Ora iscrizione annullata" },
  { column: "descrizione", type: "text", appField: "Descrizione" },
  { column: "connesso_a", type: "text", appField: "Connesso a" },
  { column: "creato_da", type: "text", appField: "Creato da" },
  { column: "data_click", type: "timestamp", appField: "Data Click" },
  { column: "data_ora", type: "timestamp", appField: "Data/Ora" },
] as const satisfies readonly LeadRecordField[]

export const LEAD_RECORD_APP_FIELD_TO_COLUMN = Object.fromEntries(
  LEAD_RECORD_FIELDS.map((field) => [field.appField, field.column]),
) as Record<LeadRecordField["appField"], string>
