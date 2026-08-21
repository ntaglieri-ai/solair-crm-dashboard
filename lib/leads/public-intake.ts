// Ingestion pubblica lead (chatbot, Meta Ads via Pabbly, configuratore autonomo).
// Usa il client service-role (bypassa RLS) perché queste sorgenti NON hanno una
// sessione utente CRM — l'autenticazione avviene via API key per sorgente
// (vedi app/api/public/lead-intake/route.ts), non via cookie di sessione.
import { createAdminClient } from "@/lib/supabase/admin"
import { assignLeadTag, ensureLeadTag } from "@/lib/leads/discount-tag"
import type { SupabaseClient } from "@supabase/supabase-js"

export type LeadIntakeOrigine = "chatbot" | "meta_ads" | "configuratore" | "manuale"
export type LeadIntakeTipoDocumento = "preventivo" | "contratto"

export interface LeadIntakePayload {
  origine: LeadIntakeOrigine
  tipo_documento?: LeadIntakeTipoDocumento
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
  codiceSconto?: string
  codice_sconto?: string
  scontoPercentuale?: number | string
  sconto_percentuale?: number | string
  prezzoTotale?: number | string
  prezzo_totale?: number | string
  prezzoFinale?: number | string
  prezzo_finale?: number | string
  noteCodiceSconto?: string
  note_codice_sconto?: string
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

const ROME_TIME_ZONE = "Europe/Rome"
const CONFIGURATOR_RECALL_TASK = "Richiamare per conferma preventivo"
const CONFIGURATOR_TAGS = {
  configuratore: { name: "Configuratore", color: "#2563EB" },
  preventivo: { name: "Preventivo configurato", color: "#14B8A6" },
  richiamare: { name: "Da richiamare", color: "#F59E0B" },
  fuoriOrario: { name: "Fuori orario", color: "#8B5CF6" },
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

function normalizeTipoDocumento(value: unknown): LeadIntakeTipoDocumento | null {
  return value === "preventivo" || value === "contratto" ? value : null
}

function hasConfiguredQuote(payload: LeadIntakePayload) {
  return Boolean(
    normalizeNumber(payload.kwp ?? payload.potenzaKw) != null ||
      normalizeNumber(payload.kwh ?? payload.accumuloKwh) != null ||
      normalizeText(payload.modelloPannello) ||
      payload.tipo_documento === "preventivo",
  )
}

function hasAnyConsent(...values: Array<boolean | null>) {
  return values.some((value) => value === true)
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score))
}

function intakeScore(params: {
  payload: LeadIntakePayload
  emailNorm: string | null
  kwp: number | null
  kwh: number | null
  consensoTelefono: boolean | null
  consensoWhatsapp: boolean | null
  consensoEmail: boolean | null
}) {
  let score = 0

  if (params.payload.origine === "configuratore") score += 35
  else if (params.payload.origine === "chatbot") score += 20
  else if (params.payload.origine === "meta_ads") score += 15

  if (params.payload.telefono) score += 10
  if (params.emailNorm) score += 10
  if (params.kwp != null || params.kwh != null || normalizeText(params.payload.modelloPannello))
    score += 25
  if (params.payload.tipo_documento === "preventivo") score += 10
  if (params.payload.residenteInSicilia === true) score += 5
  if (hasAnyConsent(params.consensoTelefono, params.consensoWhatsapp, params.consensoEmail))
    score += 5
  if (discountCode(params.payload)) score += 5

  return clampScore(score)
}

function romeDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

function utcDateFromRomeParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const rendered = romeDateParts(guess)
  const renderedAsUtc = Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
  )
  const intendedAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  return new Date(guess.getTime() - (renderedAsUtc - intendedAsUtc))
}

function addLocalDays(parts: ReturnType<typeof romeDateParts>, days: number) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0))
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  }
}

function dayOfWeek(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function nextBusinessMorning(parts: ReturnType<typeof romeDateParts>) {
  let candidate = addLocalDays(parts, 1)
  while (dayOfWeek(candidate.year, candidate.month, candidate.day) === 0 ||
    dayOfWeek(candidate.year, candidate.month, candidate.day) === 6) {
    candidate = addLocalDays(
      { ...parts, year: candidate.year, month: candidate.month, day: candidate.day },
      1,
    )
  }
  return utcDateFromRomeParts(candidate.year, candidate.month, candidate.day, 9)
}

function recallDueDate(now = new Date()) {
  const parts = romeDateParts(now)
  const dow = dayOfWeek(parts.year, parts.month, parts.day)
  const weekend = dow === 0 || dow === 6

  if (weekend || parts.hour >= 17) return nextBusinessMorning(parts)
  if (parts.hour < 9) return utcDateFromRomeParts(parts.year, parts.month, parts.day, 9)

  return new Date(now.getTime() + 2 * 60 * 60 * 1000)
}

function isOutOfBusinessHours(now = new Date()) {
  const parts = romeDateParts(now)
  const dow = dayOfWeek(parts.year, parts.month, parts.day)
  return dow === 0 || dow === 6 || parts.hour < 9 || parts.hour >= 17
}

function discountCode(payload: LeadIntakePayload) {
  return normalizeText(payload.codiceSconto ?? payload.codice_sconto)
}

function buildDiscountNote(payload: LeadIntakePayload) {
  const codice = discountCode(payload)
  if (!codice) return null

  const sconto = normalizeNumber(payload.scontoPercentuale ?? payload.sconto_percentuale)
  const prezzoTotale = normalizeNumber(payload.prezzoTotale ?? payload.prezzo_totale)
  const prezzoFinale = normalizeNumber(payload.prezzoFinale ?? payload.prezzo_finale)
  const note = normalizeText(payload.noteCodiceSconto ?? payload.note_codice_sconto)
  const parts = [`Codice sconto: ${codice}`]
  if (sconto != null) parts.push(`Sconto: ${sconto}%`)
  if (prezzoTotale != null) parts.push(`Prezzo prima dello sconto: ${prezzoTotale.toLocaleString("it-IT")} EUR`)
  if (prezzoFinale != null) parts.push(`Prezzo finale indicato: ${prezzoFinale.toLocaleString("it-IT")} EUR`)
  if (note) parts.push(`Nota codice sconto: ${note}`)
  return parts.join("\n")
}

function buildDescription(payload: LeadIntakePayload) {
  const parts: string[] = []
  if (payload.note?.trim()) parts.push(payload.note.trim())
  const scontoNote = buildDiscountNote(payload)
  if (scontoNote) parts.push(scontoNote)

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
): Promise<{
  id: string
  nome_lead: string | null
  descrizione: string | null
  lead_proprietario_id: string | null
  valutazione: number | null
} | null> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const orParts = [`telefono.eq.${telefonoNorm}`]
  if (emailNorm) orParts.push(`email.eq.${emailNorm}`)

  const { data, error } = await supabase
    .from("leads")
    .select("id, nome_lead, descrizione, lead_proprietario_id, valutazione")
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`findExistingLead: ${error.message}`)
  return data
}

async function assignTags(
  supabase: SupabaseClient,
  leadId: string,
  tags: Array<{ name: string; color: string }>,
) {
  for (const tag of tags) {
    const tagId = await ensureLeadTag(supabase, tag.name, tag.color)
    await assignLeadTag(supabase, leadId, tagId)
  }
}

async function createLeadActivity(
  supabase: SupabaseClient,
  leadId: string,
  text: string,
) {
  const { error } = await supabase.from("attivita").insert({
    record_tipo: "lead",
    record_id: leadId,
    tipo: "nuovo-lead",
    testo: text,
  })
  if (error) console.error(`[lead-intake] attivita lead ${leadId}:`, error.message)
}

async function ensureRecallTask(
  supabase: SupabaseClient,
  params: {
    leadId: string
    leadName: string
    ownerId: string | null
    dueDate: Date
    highPriority: boolean
    description: string
  },
) {
  const { data: existing, error: lookupError } = await supabase
    .from("compiti")
    .select("id")
    .eq("correlato_tipo", "lead")
    .eq("correlato_id", params.leadId)
    .eq("oggetto", CONFIGURATOR_RECALL_TASK)
    .neq("stato", "Completato")
    .limit(1)

  if (lookupError) {
    console.error(`[lead-intake] lookup compito lead ${params.leadId}:`, lookupError.message)
    return
  }

  const row = {
    oggetto: CONFIGURATOR_RECALL_TASK,
    descrizione: params.description,
    stato: "Non iniziato",
    priorita: params.highPriority ? "Alto" : "Medio",
    scadenza: params.dueDate.toISOString(),
    proprietario_id: params.ownerId,
    correlato_id: params.leadId,
    correlato_nome: params.leadName,
    correlato_tipo: "lead",
    tag: "Configuratore",
    updated_at: new Date().toISOString(),
  }

  if (existing && existing.length > 0) {
    const { error } = await supabase.from("compiti").update(row).eq("id", existing[0].id)
    if (error) console.error(`[lead-intake] update compito lead ${params.leadId}:`, error.message)
    return
  }

  const { error } = await supabase.from("compiti").insert(row)
  if (error) console.error(`[lead-intake] creazione compito lead ${params.leadId}:`, error.message)
}

export async function ingestLead(payload: LeadIntakePayload): Promise<LeadIntakeResult> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  const now = new Date()
  const telefonoNorm = normalizePhone(payload.telefono)
  const emailNorm = payload.email ? normalizeEmail(payload.email) : null
  const kwp = normalizeNumber(payload.kwp ?? payload.potenzaKw)
  const kwh = normalizeNumber(payload.kwh ?? payload.accumuloKwh)
  const tipoDocumento = normalizeTipoDocumento(payload.tipo_documento)
  const description = buildDescription(payload)
  const hasDiscountCode = Boolean(discountCode(payload))
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
  const calculatedScore = intakeScore({
    payload,
    emailNorm,
    kwp,
    kwh,
    consensoTelefono,
    consensoWhatsapp,
    consensoEmail,
  })
  const quoteConfigured = hasConfiguredQuote(payload)
  const configuratorLead = payload.origine === "configuratore"
  const outOfHours = isOutOfBusinessHours(now)

  const existing = await findExistingLead(telefonoNorm, emailNorm)

  if (existing) {
    const timestamp = now.toLocaleString("it-IT", { timeZone: ROME_TIME_ZONE })
    const notaIngresso = `[${timestamp}] Nuovo contatto da ${ORIGINE_LABELS[payload.origine]}${
      description ? `:\n${description}` : ""
    }`
    const descrizioneAggiornata = existing.descrizione
      ? `${existing.descrizione}\n${notaIngresso}`
      : notaIngresso

    const updateRow: Record<string, unknown> = {
      descrizione: descrizioneAggiornata,
      valutazione: Math.max(existing.valutazione ?? 0, calculatedScore),
      ora_ultima_attivita: now.toISOString(),
      updated_at: now.toISOString(),
    }
    if (consensoTelefono !== null) updateRow.consenso_contatto_telefono = consensoTelefono
    if (consensoWhatsapp !== null) updateRow.consenso_contatto_whatsapp = consensoWhatsapp
    if (consensoEmail !== null) updateRow.consenso_contatto_email = consensoEmail
    if (tipoDocumento !== null) updateRow.tipo_documento = tipoDocumento

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateRow)
      .eq("id", existing.id)

    if (updateError) throw new Error(`ingestLead update: ${updateError.message}`)
    if (hasDiscountCode) {
      const tagId = await ensureLeadTag(supabase)
      await assignLeadTag(supabase, existing.id, tagId)
    }
    if (configuratorLead) {
      const tags = [
        CONFIGURATOR_TAGS.configuratore,
        CONFIGURATOR_TAGS.richiamare,
        ...(quoteConfigured ? [CONFIGURATOR_TAGS.preventivo] : []),
        ...(outOfHours ? [CONFIGURATOR_TAGS.fuoriOrario] : []),
      ]
      await assignTags(supabase, existing.id, tags)
      await createLeadActivity(
        supabase,
        existing.id,
        `Nuovo passaggio dal configuratore: preventivo aggiornato e richiamo pianificato.`,
      )
      await ensureRecallTask(supabase, {
        leadId: existing.id,
        leadName: existing.nome_lead ?? payload.nome,
        ownerId: existing.lead_proprietario_id,
        dueDate: recallDueDate(now),
        highPriority: calculatedScore >= 80,
        description: `Lead già presente: nuovo passaggio dal configuratore. Verificare dati aggiornati e richiamare per confermare il preventivo.`,
      })
    }

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
      valutazione: calculatedScore,
      campaign_name: payload.campaignName || null,
      kwp,
      kwh,
      modello_pannello: payload.modelloPannello || null,
      wallbox_richiesto: payload.wallboxRichiesto ?? false,
      tipo_documento: tipoDocumento,
      consenso_contatto_telefono: consensoTelefono ?? false,
      consenso_contatto_whatsapp: consensoWhatsapp ?? false,
      consenso_contatto_email: consensoEmail ?? false,
      descrizione: description,
      paese: "Italia",
      ora_ultima_attivita: now.toISOString(),
    })
    .select("id, nome_lead")
    .single()

  if (error) throw new Error(`ingestLead insert: ${error.message}`)
  if (hasDiscountCode) {
    const tagId = await ensureLeadTag(supabase)
    await assignLeadTag(supabase, data.id as string, tagId)
  }
  if (configuratorLead) {
    const leadId = data.id as string
    const leadName = (data.nome_lead as string) ?? payload.nome
    const tags = [
      CONFIGURATOR_TAGS.configuratore,
      CONFIGURATOR_TAGS.richiamare,
      ...(quoteConfigured ? [CONFIGURATOR_TAGS.preventivo] : []),
      ...(outOfHours ? [CONFIGURATOR_TAGS.fuoriOrario] : []),
    ]
    await assignTags(supabase, leadId, tags)
    await createLeadActivity(
      supabase,
      leadId,
      `Lead acquisito dal configuratore: creato con punteggio ${calculatedScore}/100 e richiamo pianificato.`,
    )
    await ensureRecallTask(supabase, {
      leadId,
      leadName,
      ownerId: null,
      dueDate: recallDueDate(now),
      highPriority: calculatedScore >= 80,
      description: `Lead generato dal configuratore web. Richiamare per confermare il preventivo e prendere in carico il contatto.`,
    })
  }

  return { id: data.id as string, duplicate: false, nomeLead: (data.nome_lead as string) ?? payload.nome }
}
