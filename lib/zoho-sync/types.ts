import type { SupabaseClient } from "@supabase/supabase-js"

export type ZohoSyncMode = "dry_run" | "write"
export type ZohoSyncStatus = "running" | "completed" | "failed"
export type ZohoSyncAction = "create" | "update" | "skip" | "conflict" | "error"
export type ZohoSyncModule = "leads" | "clienti" | "compiti" | "scadenze" | "installatori"
export type ZohoFieldType = "text" | "number" | "boolean" | "timestamp" | "zoho_id" | "owner_lookup"
export type SyncValue = string | number | boolean | null

export type CsvRow = Record<string, string | undefined>

export type LeadColumn =
  | "zoho_id"
  | "zoho_owner_id"
  | "lead_proprietario_id"
  | "nome"
  | "cognome"
  | "nome_lead"
  | "email"
  | "telefono"
  | "origine_lead"
  | "stato_lead"
  | "zoho_creato_da_id"
  | "creato_da"
  | "created_at"
  | "saluti"
  | "ora_ultima_attivita"
  | "citta"
  | "provincia"
  | "codice_postale"
  | "paese"
  | "descrizione"
  | "valutazione"
  | "zoho_account_convertito_id"
  | "zoho_contatto_convertito_id"
  | "contatto_convertito"
  | "zoho_modified_at"
  | "convertito"
  | "bloccato"
  | "residente_in_sicilia"
  | "campaign_name"
  | "mobile_fisso"
  | "stato_email"
  | "social_lead_id"
  | "data_sopralluogo"
  | "zoho_installatore_sopralluogo_id"
  | "connesso_a"
  | "zoho_connesso_a_id"
  | "data_click"
  | "data_ora"
  | "tempo_conversione_lead"
  | "modalita_iscrizione_annullata"
  | "ora_iscrizione_annullata"

export type LeadZohoMapping = {
  csvHeader: string
  column: LeadColumn
  type: ZohoFieldType
  updateExisting: boolean
}

export type NormalizedLead = Partial<Record<LeadColumn, SyncValue>> & {
  zoho_id: string
}

export type LeadCrmRecord = Partial<Record<LeadColumn, SyncValue>> & {
  id: string
  zoho_id: string | null
  zoho_synced_at: string | null
}

export type FieldDiff = {
  field: string
  crmValue: SyncValue
  zohoValue: SyncValue
  writeBlockedReason?: "empty_zoho_preserves_crm"
}

export type SyncIssue = {
  message: string
  rowNumber?: number
  zohoId?: string | null
}

export type LeadDiffResult = {
  action: ZohoSyncAction
  zohoId: string | null
  crmRecordId: string | null
  diffs: FieldDiff[]
  error: string | null
  payloadSummary: Record<string, unknown>
}

export type SyncDiffResult = LeadDiffResult

export type ZohoSyncStats = {
  csvRows: number
  mappedRows: number
  create: number
  update: number
  skip: number
  conflict: number
  error: number
  duplicateZohoIds: number
  missingZohoIds: number
  unresolvedOwnerIds: string[]
  unresolvedInstallatoreIds?: string[]
  unmappedHeaders: string[]
}

export type ZohoSyncRunResult = {
  runId: string | null
  stats: ZohoSyncStats
  events: LeadDiffResult[]
}

export type SupabaseLike = SupabaseClient
