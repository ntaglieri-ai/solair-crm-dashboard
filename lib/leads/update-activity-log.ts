import type { SupabaseClient } from "@supabase/supabase-js"

export type LeadUpdateSource =
  | "make"
  | "meta"
  | "facebook"
  | "instagram"
  | "configuratore"
  | "manuale"
  | "import"
  | "api"

export type LeadUpdateReason =
  | "nuova_richiesta"
  | "duplicato_aggiornato"
  | "modifica_campi"
  | "modifica_massiva"
  | "preventivo_aggiornato"

const SOURCE_LABELS: Record<LeadUpdateSource, string> = {
  make: "Make",
  meta: "Meta Ads",
  facebook: "Facebook Lead Ads",
  instagram: "Instagram",
  configuratore: "Configuratore sito",
  manuale: "modifica manuale",
  import: "importazione o sincronizzazione",
  api: "integrazione esterna",
}

const REASON_LABELS: Record<LeadUpdateReason, string> = {
  nuova_richiesta: "nuova richiesta ricevuta",
  duplicato_aggiornato: "lead gia' presente, aggiornato come duplicato",
  modifica_campi: "modifica dei dati del lead",
  modifica_massiva: "modifica massiva dalla lista Lead",
  preventivo_aggiornato: "preventivo o configurazione aggiornati",
}

function compact(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim()))
}

function formatChangedFields(fields: string[] | undefined) {
  const cleaned = Array.from(new Set((fields ?? []).map((field) => field.trim()).filter(Boolean)))
  if (cleaned.length === 0) return null
  if (cleaned.length <= 6) return cleaned.join(", ")
  return `${cleaned.slice(0, 6).join(", ")} e altri ${cleaned.length - 6} campi`
}

export function buildLeadUpdateActivityText(params: {
  source: LeadUpdateSource
  reason: LeadUpdateReason
  action?: "aggiornato" | "creato"
  sourceDetail?: string | null
  changedFields?: string[]
  details?: Array<string | null | undefined>
  note?: string | null
}) {
  const source = SOURCE_LABELS[params.source]
  const reason = REASON_LABELS[params.reason]
  const changedFields = formatChangedFields(params.changedFields)
  const action = params.action ?? "aggiornato"
  const lines = compact([
    `Lead ${action} da ${source}`,
    params.sourceDetail ? `Origine aggiornamento: ${params.sourceDetail}` : null,
    `Motivo: ${reason}.`,
    changedFields ? `Campi interessati: ${changedFields}.` : null,
    ...compact(params.details ?? []),
    params.note,
    action === "aggiornato"
      ? "Effetto: riportato in cima perche' e' cambiata l'ultima attivita'."
      : "Effetto: inserito in cima perche' e' la sua prima attivita'.",
  ])

  return lines.join("\n")
}

export async function insertLeadUpdateActivity(
  supabase: SupabaseClient,
  params: {
    leadId: string
    text: string
    userId?: string | null
    logPrefix?: string
  },
) {
  const row: Record<string, unknown> = {
    record_tipo: "lead",
    record_id: params.leadId,
    tipo: "cambio-stato",
    testo: params.text,
  }
  if (params.userId) row.utente_id = params.userId

  const { error } = await supabase.from("attivita").insert(row)
  if (error) {
    console.error(`${params.logPrefix ?? "[lead-update-activity]"} ${params.leadId}:`, error.message)
  }
}
