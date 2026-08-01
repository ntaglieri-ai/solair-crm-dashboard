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
  tipoProprieta?: "privata" | "commerciale"
  note?: string
  consensoWhatsapp?: boolean
  consensoMarketingEmail?: boolean
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

  const existing = await findExistingLead(telefonoNorm, emailNorm)

  if (existing) {
    const timestamp = new Date().toLocaleString("it-IT")
    const notaIngresso = `[${timestamp}] Nuovo contatto da ${ORIGINE_LABELS[payload.origine]}${
      payload.note ? `: ${payload.note}` : ""
    }`
    const descrizioneAggiornata = existing.descrizione
      ? `${existing.descrizione}\n${notaIngresso}`
      : notaIngresso

    const { error: updateError } = await supabase
      .from("leads")
      .update({ descrizione: descrizioneAggiornata, updated_at: new Date().toISOString() })
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
      stato_lead: "Non contattato",
      origine_lead: ORIGINE_LABELS[payload.origine],
      descrizione: payload.note || null,
      paese: "Italia",
    })
    .select("id, nome_lead")
    .single()

  if (error) throw new Error(`ingestLead insert: ${error.message}`)

  return { id: data.id as string, duplicate: false, nomeLead: (data.nome_lead as string) ?? payload.nome }
}
