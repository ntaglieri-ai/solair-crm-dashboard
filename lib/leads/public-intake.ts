// Ingestion pubblica lead (chatbot, Meta Ads via Pabbly, configuratore autonomo).
// Usa il client service-role (bypassa RLS) perché queste sorgenti NON hanno una
// sessione utente CRM — l'autenticazione avviene via API key per sorgente
// (vedi app/api/public/lead-intake/route.ts), non via cookie di sessione.
import { createAdminClient } from "@/lib/supabase/admin"

export type LeadIntakeOrigine = "chatbot" | "meta_ads" | "configuratore" | "manuale"

export interface LeadIntakePayload {
  origine: LeadIntakeOrigine
  nome: string
  telefono: string
  email?: string
  provincia?: string
  citta?: string
  codicePostale?: string
  residenteInSicilia?: boolean
  tipoProprieta?: "privata" | "commerciale"
  campaignName?: string
  kwp?: number | string
  kwh?: number | string
  potenzaKw?: number | string
  accumuloKwh?: number | string
  modelloPannello?: string
  wallboxRichiesto?: boolean
  interesse?: string
  offertaNome?: string
  offertaUrl?: string
  consumoAnnuoKwh?: number | string
  note?: string
  consensoTelefono?: boolean
  consensoWhatsapp?: boolean
  consensoEmail?: boolean
  consensoMarketingEmail?: boolean
  consenso_contatto_telefono?: boolean
  consenso_contatto_whatsapp?: boolean
  consenso_contatto_email?: boolean
  consensi_contatto?: {
    telefono?: boolean
    whatsapp?: boolean
    email?: boolean
  }
}

const ORIGINE_LABELS: Record<LeadIntakeOrigine, string> = {
  chatbot: "Chat",
  meta_ads: "Pubblicità",
  configuratore: "Configuratore WebSite",
  manuale: "Inserimento manuale",
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "")
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Number(value.trim().replace(/\./g, "").replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function buildDescription(payload: LeadIntakePayload) {
  const parts: string[] = []
  if (payload.note?.trim()) parts.push(payload.note.trim())

  const interesse = normalizeText(payload.interesse)
  const offertaNome = normalizeText(payload.offertaNome)
  const offertaUrl = normalizeText(payload.offertaUrl)
  const consumoAnnuo = normalizeNumber(payload.consumoAnnuoKwh)
  const tipoProprieta = normalizeText(payload.tipoProprieta)

  if (interesse) parts.push(`Interesse chatbot: ${interesse}`)
  if (offertaNome) parts.push(`Offerta citata: ${offertaNome}`)
  if (offertaUrl) parts.push(`Link offerta: ${offertaUrl}`)
  if (tipoProprieta) parts.push(`Tipo proprieta': ${tipoProprieta}`)
  if (consumoAnnuo != null) parts.push(`Consumo annuo indicato: ${consumoAnnuo} kWh`)

  return parts.length ? parts.join("\n") : null
}

export interface LeadIntakeResult {
  id: string
  duplicate: boolean
  nomeLead: string
}

async function findExistingLead(
  telefonoNorm: string,
  emailNorm: string | null,
): Promise<{ id: string; nome_lead: string | null; descrizione: string | null } | null> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const orParts = [`telefono.eq.${telefonoNorm}`]
  if (emailNorm) orParts.push(`email.eq.${emailNorm}`)

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome_lead, descrizione")
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`findExistingLead: ${error.message}`)
  return data
}

export async function ingestLead(payload: LeadIntakePayload): Promise<LeadIntakeResult> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const telefonoNorm = normalizePhone(payload.telefono)
  const emailNorm = payload.email ? normalizeEmail(payload.email) : null
  const kwp = normalizeNumber(payload.kwp ?? payload.potenzaKw)
  const kwh = normalizeNumber(payload.kwh ?? payload.accumuloKwh)
  const description = buildDescription(payload)
  const consensoTelefono = normalizeBoolean(
    payload.consensoTelefono ??
      payload.consenso_contatto_telefono ??
      payload.consensi_contatto?.telefono,
  )
  const consensoWhatsapp = normalizeBoolean(
    payload.consensoWhatsapp ??
      payload.consenso_contatto_whatsapp ??
      payload.consensi_contatto?.whatsapp,
  )
  const consensoEmail = normalizeBoolean(
    payload.consensoEmail ??
      payload.consensoMarketingEmail ??
      payload.consenso_contatto_email ??
      payload.consensi_contatto?.email,
  )

  const existing = await findExistingLead(telefonoNorm, emailNorm)

  if (existing) {
    const timestamp = new Date().toLocaleString("it-IT")
    const notaIngresso = `[${timestamp}] Nuovo contatto da ${ORIGINE_LABELS[payload.origine]}${
      description ? `:\n${description}` : ""
    }`
    const descrizioneAggiornata = existing.descrizione
      ? `${existing.descrizione}\n${notaIngresso}`
      : notaIngresso

    const updateRow: Record<string, unknown> = {
      descrizione: descrizioneAggiornata,
      updated_at: new Date().toISOString(),
    }
    if (consensoTelefono !== null) updateRow.consenso_contatto_telefono = consensoTelefono
    if (consensoWhatsapp !== null) updateRow.consenso_contatto_whatsapp = consensoWhatsapp
    if (consensoEmail !== null) updateRow.consenso_contatto_email = consensoEmail

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateRow)
      .eq("id", existing.id)

    if (updateError) throw new Error(`ingestLead update: ${updateError.message}`)

    return { id: existing.id, duplicate: true, nomeLead: existing.nome_lead ?? payload.nome }
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      nome_lead: payload.nome,
      telefono: telefonoNorm,
      email: emailNorm || null,
      provincia: payload.provincia || null,
      citta: payload.citta || null,
      codice_postale: payload.codicePostale || null,
      residente_in_sicilia: payload.residenteInSicilia ?? false,
      stato_lead: "Non contattato",
      origine_lead: ORIGINE_LABELS[payload.origine],
      campaign_name: payload.campaignName || null,
      kwp,
      kwh,
      modello_pannello: payload.modelloPannello || null,
      wallbox_richiesto: payload.wallboxRichiesto ?? false,
      consenso_contatto_telefono: consensoTelefono ?? false,
      consenso_contatto_whatsapp: consensoWhatsapp ?? false,
      consenso_contatto_email: consensoEmail ?? false,
      descrizione: description,
      paese: "Italia",
    })
    .select("id, nome_lead")
    .single()

  if (error) throw new Error(`ingestLead insert: ${error.message}`)

  return { id: data.id as string, duplicate: false, nomeLead: (data.nome_lead as string) ?? payload.nome }
}
