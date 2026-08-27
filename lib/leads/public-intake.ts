// Ingestion pubblica lead (chatbot, Meta Ads via Pabbly, configuratore autonomo).
// Usa il client service-role (bypassa RLS) perché queste sorgenti NON hanno una
// sessione utente CRM — l'autenticazione avviene via API key per sorgente
// (vedi app/api/public/lead-intake/route.ts), non via cookie di sessione.
import { createAdminClient } from "@/lib/supabase/admin"
import { assignLeadTag, ensureLeadTag } from "@/lib/leads/discount-tag"
import {
  buildLeadUpdateActivityText,
  insertLeadUpdateActivity,
  type LeadUpdateSource,
} from "@/lib/leads/update-activity-log"
import type { SupabaseClient } from "@supabase/supabase-js"

export type LeadIntakeOrigine = "chatbot" | "meta_ads" | "configuratore" | "manuale"
export type LeadIntakeTipoDocumento = "preventivo" | "contratto"

export interface LeadIntakePayload {
  origine: LeadIntakeOrigine
  tipo_documento?: LeadIntakeTipoDocumento
  nome: string
  firstName?: string
  lastName?: string
  cognome?: string
  telefono: string
  email?: string
  provincia?: string
  citta?: string
  codicePostale?: string
  residenteInSicilia?: boolean
  tipoProprieta?: "privata" | "commerciale"
  campaignName?: string
  socialLeadId?: string
  sourceCreatedAt?: string | number
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
  source?: string
  sourcePlatform?: string
  piattaforma?: string
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

type IntakeInputRecord = Record<string, unknown>
type IntakeFieldMap = Record<string, string>

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
  nuovo: { name: "Nuovo lead", color: "#22C55E" },
  aggiornato: { name: "Lead aggiornato", color: "#EC4899" },
}

function isRecord(value: unknown): value is IntakeInputRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeIntakeFieldName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (Array.isArray(value)) {
    const parts = value.map(stringFromUnknown).filter(Boolean)
    return parts.length ? parts.join(", ") : undefined
  }
  return undefined
}

function booleanFromUnknown(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  const text = stringFromUnknown(value)?.toLowerCase()
  if (!text) return undefined
  if (["1", "true", "yes", "si", "sì", "ok", "accepted", "accetto"].includes(text)) return true
  if (["0", "false", "no", "non", "declined", "rifiuto"].includes(text)) return false
  return undefined
}

function flattenFieldsFromRecord(record: IntakeInputRecord): IntakeFieldMap {
  const fields: IntakeFieldMap = {}

  for (const [key, value] of Object.entries(record)) {
    if (key === "field_data" || key === "custom_disclaimer_responses") continue
    const text = stringFromUnknown(value)
    if (text) fields[normalizeIntakeFieldName(key)] = text
  }

  return fields
}

function flattenFieldData(value: unknown): IntakeFieldMap {
  const fields: IntakeFieldMap = {}

  if (Array.isArray(value)) {
    for (const field of value) {
      if (!isRecord(field)) continue
      const name =
        stringFromUnknown(field.name) ??
        stringFromUnknown(field.key) ??
        stringFromUnknown(field.label) ??
        stringFromUnknown(field.question)
      if (!name) continue
      const text =
        stringFromUnknown(field.values) ??
        stringFromUnknown(field.value) ??
        stringFromUnknown(field.answer) ??
        stringFromUnknown(field.response)
      if (text) fields[normalizeIntakeFieldName(name)] = text
    }
    return fields
  }

  if (isRecord(value)) return flattenFieldsFromRecord(value)
  return fields
}

function pickField(fields: IntakeFieldMap, names: string[]) {
  for (const name of names) {
    const value = fields[normalizeIntakeFieldName(name)]
    if (value) return value
  }
  return undefined
}

function normalizeOrigine(value: unknown, fields: IntakeFieldMap): LeadIntakeOrigine | undefined {
  const raw = stringFromUnknown(value)
  const normalized = raw ? normalizeIntakeFieldName(raw) : ""

  if (normalized === "chatbot" || normalized === "chat") return "chatbot"
  if (
    normalized === "meta_ads" ||
    normalized === "facebook" ||
    normalized === "facebook_lead_ads" ||
    normalized === "fb" ||
    normalized === "make" ||
    normalized === "pabbly"
  ) return "meta_ads"
  if (normalized === "configuratore" || normalized === "website" || normalized === "sito") {
    return "configuratore"
  }
  if (normalized === "manuale" || normalized === "manual") return "manuale"

  const hasMetaMarkers = Boolean(
    pickField(fields, ["leadgen_id", "lead_id", "form_id", "ad_id", "adgroup_id", "page_id"]),
  )
  return hasMetaMarkers ? "meta_ads" : undefined
}

function normalizeTipoProprietaFromField(value: string | undefined) {
  if (!value) return undefined
  const normalized = normalizeIntakeFieldName(value)
  if (normalized.includes("commercial")) return "commerciale"
  if (normalized.includes("privat") || normalized.includes("residen")) return "privata"
  return undefined
}

function buildMakeMetaNote(fields: IntakeFieldMap, existingNote?: string) {
  const leadgenId = pickField(fields, ["leadgen_id", "lead_id", "id"])
  const pageId = pickField(fields, ["page_id"])
  const formId = pickField(fields, ["form_id"])
  const adId = pickField(fields, ["ad_id"])
  const adgroupId = pickField(fields, ["adgroup_id"])
  const createdAt = pickField(fields, ["created_time", "created_at"])
  const metadata = [
    leadgenId ? `Leadgen ID: ${leadgenId}` : null,
    pageId ? `Page ID: ${pageId}` : null,
    formId ? `Form ID: ${formId}` : null,
    adId ? `Ad ID: ${adId}` : null,
    adgroupId ? `Adgroup ID: ${adgroupId}` : null,
    createdAt ? `Creato Meta: ${createdAt}` : null,
  ].filter(Boolean)

  const answerKeys = new Set([
    "full_name",
    "nome",
    "nome_e_cognome",
    "name",
    "first_name",
    "last_name",
    "phone_number",
    "phone",
    "telefono",
    "email",
    "city",
    "citta",
    "comune",
    "state",
    "province",
    "provincia",
    "campaign_name",
    "campaignname",
    "campaign",
    "campagna",
    "nome_campagna",
    "leadgen_id",
    "lead_id",
    "social_lead_id",
  ])
  const answers = Object.entries(fields)
    .filter(([key]) => !answerKeys.has(key))
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")

  return (
    [existingNote, metadata.length ? metadata.join("\n") : null, answers ? `Dati sorgente: ${answers}` : null]
      .filter(Boolean)
      .join("\n\n") || undefined
  )
}

export function normalizeLeadIntakePayload(input: unknown): Partial<LeadIntakePayload> {
  if (!isRecord(input)) return {}

  const nestedRecords = ["lead", "data", "payload", "event"]
    .map((key) => input[key])
    .filter(isRecord)
  const records = [input, ...nestedRecords]
  const fields: IntakeFieldMap = {}
  for (const record of records) {
    Object.assign(fields, flattenFieldsFromRecord(record))
    Object.assign(fields, flattenFieldData(record.field_data))
    Object.assign(fields, flattenFieldData(record.custom_disclaimer_responses))
  }

  const direct = input as Partial<LeadIntakePayload>
  const firstName =
    direct.firstName ??
    pickField(fields, ["first_name", "nome_di_battesimo", "given_name", "first"])
  const lastName =
    direct.lastName ??
    direct.cognome ??
    pickField(fields, ["last_name", "cognome", "surname", "family_name"])
  const nome = (
    direct.nome ??
    pickField(fields, ["full_name", "nome", "nome_e_cognome", "name"]) ??
    [firstName, lastName]
      .filter(Boolean)
      .join(" ")
  ) || undefined
  const telefono =
    direct.telefono ??
    pickField(fields, [
      "phone_number",
      "phone",
      "telefono",
      "mobile_phone",
      "cellulare",
      "numero_di_telefono",
    ])
  const email = direct.email ?? pickField(fields, ["email", "e_mail", "indirizzo_email"])
  const note = buildMakeMetaNote(fields, direct.note)
  const origine = normalizeOrigine(direct.origine ?? fields.origine, fields)

  return {
    ...direct,
    origine,
    tipo_documento:
      direct.tipo_documento ??
      normalizeTipoDocumento(pickField(fields, ["tipo_documento", "tipo documento", "documento"])) ??
      undefined,
    nome,
    firstName,
    lastName,
    cognome: direct.cognome ?? lastName,
    telefono,
    email,
    provincia: direct.provincia ?? pickField(fields, ["state", "province", "provincia"]),
    citta: direct.citta ?? pickField(fields, ["city", "citta", "comune"]),
    codicePostale:
      direct.codicePostale ??
      pickField(fields, ["zip_code", "postal_code", "codice_postale", "cap"]),
    residenteInSicilia:
      direct.residenteInSicilia ??
      booleanFromUnknown(
        pickField(fields, [
          "residente_in_sicilia",
          "residente_sicilia",
          "sicilia",
          "sei_residente_in_sicilia",
        ]),
      ),
    tipoProprieta:
      direct.tipoProprieta ??
      normalizeTipoProprietaFromField(
        pickField(fields, ["tipo_proprieta", "tipo_di_proprieta", "property_type"]),
      ),
    campaignName:
      direct.campaignName ??
      pickField(fields, ["campaign_name", "campaignName", "campaign", "campagna", "nome_campagna"]),
    socialLeadId:
      direct.socialLeadId ??
      pickField(fields, ["leadgen_id", "lead_id", "social_lead_id"]),
    sourceCreatedAt:
      direct.sourceCreatedAt ??
      pickField(fields, ["created_time", "created_at", "date_created", "date created"]),
    kwp:
      direct.kwp ??
      direct.potenzaKw ??
      pickField(fields, ["kwp", "potenza_kw", "potenza", "potenza_impianto"]),
    kwh:
      direct.kwh ??
      direct.accumuloKwh ??
      pickField(fields, ["kwh", "accumulo_kwh", "accumulo", "batteria_kwh"]),
    modelloPannello:
      direct.modelloPannello ??
      pickField(fields, ["modello_pannello", "pannello", "tipo_pannello"]),
    wallboxRichiesto:
      direct.wallboxRichiesto ??
      booleanFromUnknown(pickField(fields, ["wallbox_richiesto", "wallbox", "colonnina"])),
    interesse: direct.interesse ?? pickField(fields, ["interesse", "interest"]),
    source: direct.source ?? pickField(fields, ["source", "sorgente", "source_name"]),
    sourcePlatform:
      direct.sourcePlatform ??
      direct.piattaforma ??
      pickField(fields, [
        "source_platform",
        "publisher_platform",
        "platform",
        "piattaforma",
        "placement",
      ]),
    note,
    consensoTelefono:
      direct.consensoTelefono ??
      direct.consenso_contatto_telefono ??
      booleanFromUnknown(
        pickField(fields, [
          "consenso_telefono",
          "consenso_contatto_telefono",
          "contatto_telefono",
          "chiamata",
          "chiamami",
        ]),
      ),
    consensoWhatsapp:
      direct.consensoWhatsapp ??
      direct.consenso_contatto_whatsapp ??
      booleanFromUnknown(
        pickField(fields, [
          "consenso_whatsapp",
          "consenso_contatto_whatsapp",
          "whatsapp",
          "contatto_whatsapp",
        ]),
      ),
    consensoEmail:
      direct.consensoEmail ??
      direct.consensoMarketingEmail ??
      direct.consenso_contatto_email ??
      booleanFromUnknown(
        pickField(fields, [
          "consenso_email",
          "consenso_e_mail",
          "consenso_contatto_email",
          "consenso_marketing_email",
          "marketing_email",
          "newsletter",
        ]),
      ),
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "")
}

export function leadPhoneMatchKeys(value: unknown): string[] {
  const text = stringFromUnknown(value)
  if (!text) return []

  const digits = text.replace(/\D/g, "")
  if (!digits) return []

  const withoutInternationalPrefix = digits.startsWith("00") ? digits.slice(2) : digits
  const national =
    withoutInternationalPrefix.startsWith("39") && withoutInternationalPrefix.length > 10
      ? withoutInternationalPrefix.slice(2)
      : withoutInternationalPrefix
  const keys = [
    digits,
    withoutInternationalPrefix,
    national,
    national.length >= 8 ? `39${national}` : null,
  ].filter((key): key is string => Boolean(key))

  return Array.from(new Set(keys))
}

function phonesMatch(left: unknown, right: unknown) {
  const leftKeys = new Set(leadPhoneMatchKeys(left))
  return leadPhoneMatchKeys(right).some((key) => leftKeys.has(key))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function splitNameParts(fullName: string): { nome: string | null; cognome: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { nome: null, cognome: null }
  if (parts.length === 1) return { nome: parts[0], cognome: null }
  return { nome: parts[0], cognome: parts.slice(1).join(" ") }
}

function leadNameParts(payload: LeadIntakePayload) {
  const split = splitNameParts(payload.nome)
  return {
    nome: normalizeText(payload.firstName) ?? split.nome,
    cognome: normalizeText(payload.lastName ?? payload.cognome) ?? split.cognome,
  }
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
  const normalized = normalizeIntakeFieldName(stringFromUnknown(value) ?? "")
  if (normalized.includes("preventivo")) return "preventivo"
  if (normalized.includes("contratto")) return "contratto"
  return null
}

const ITALIAN_MONTHS: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12,
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

function addChangedField(changedFields: string[], field: string) {
  if (!changedFields.includes(field)) changedFields.push(field)
}

function assignTextField(
  updateRow: Record<string, unknown>,
  existing: Record<string, unknown>,
  changedFields: string[],
  column: string,
  label: string,
  value: unknown,
) {
  const text = normalizeText(value)
  if (!text) return

  updateRow[column] = text
  if (normalizeText(existing[column]) !== text) addChangedField(changedFields, label)
}

function assignNumberField(
  updateRow: Record<string, unknown>,
  existing: Record<string, unknown>,
  changedFields: string[],
  column: string,
  label: string,
  value: unknown,
) {
  const number = normalizeNumber(value)
  if (number === null) return

  updateRow[column] = number
  if (normalizeNumber(existing[column]) !== number) addChangedField(changedFields, label)
}

function assignBooleanField(
  updateRow: Record<string, unknown>,
  existing: Record<string, unknown>,
  changedFields: string[],
  column: string,
  label: string,
  value: boolean | null,
) {
  if (value === null) return

  updateRow[column] = value
  if (existing[column] !== value) addChangedField(changedFields, label)
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

export function parseLeadSourceCreatedAt(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000)
  }

  const text = stringFromUnknown(value)
  if (!text) return null

  const parsed = Date.parse(text)
  if (Number.isFinite(parsed)) return new Date(parsed)

  const italian = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)

  if (!italian) return null

  const [, dayText, monthText, yearText, hourText, minuteText] = italian
  const month = ITALIAN_MONTHS[monthText]
  if (!month) return null

  const day = Number(dayText)
  const year = Number(yearText)
  const hour = Number(hourText ?? 0)
  const minute = Number(minuteText ?? 0)
  if (![day, year, hour, minute].every(Number.isFinite)) return null

  return utcDateFromRomeParts(year, month, day, hour, minute)
}

function metaLeadMaxAgeMs() {
  const hours = Number(process.env.LEAD_INTAKE_META_MAX_AGE_HOURS ?? 36)
  return Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : null
}

function staleMetaLeadReason(payload: LeadIntakePayload, now: Date) {
  if (payload.origine !== "meta_ads") return null
  const sourceCreatedAt = parseLeadSourceCreatedAt(payload.sourceCreatedAt)
  const maxAgeMs = metaLeadMaxAgeMs()
  if (!sourceCreatedAt || maxAgeMs === null) return null

  return now.getTime() - sourceCreatedAt.getTime() > maxAgeMs
    ? {
        sourceCreatedAt: sourceCreatedAt.toISOString(),
        maxAgeHours: Math.round(maxAgeMs / 60 / 60 / 1000),
      }
    : null
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

function intakeSource(payload: LeadIntakePayload): {
  source: LeadUpdateSource
  detail: string
} {
  const platform = normalizeIntakeFieldName(
    normalizeText(payload.sourcePlatform ?? payload.piattaforma ?? payload.source) ?? "",
  )

  if (payload.origine === "configuratore") {
    return { source: "configuratore", detail: "Configuratore sito" }
  }
  if (payload.origine === "chatbot") {
    return { source: "api", detail: "Chatbot" }
  }
  if (payload.origine === "manuale") {
    return { source: "manuale", detail: "Inserimento manuale via API" }
  }
  if (platform.includes("make") || platform.includes("pabbly")) {
    return { source: "make", detail: "Scenario Make/Pabbly verso API pubblica" }
  }
  if (platform.includes("instagram")) {
    return { source: "instagram", detail: "Instagram tramite Make/API pubblica" }
  }
  if (platform.includes("facebook") || platform === "fb") {
    return { source: "facebook", detail: "Facebook Lead Ads tramite Make/API pubblica" }
  }
  return { source: "meta", detail: "Meta Ads tramite Make/API pubblica" }
}

function intakeReceivedDetails(payload: LeadIntakePayload) {
  return [
    `Dati ricevuti: nome ${payload.nome}`,
    payload.telefono ? `Telefono: ${payload.telefono}` : null,
    payload.email ? `Email: ${payload.email}` : null,
    payload.provincia ? `Provincia: ${payload.provincia}` : null,
    payload.citta ? `Citta': ${payload.citta}` : null,
    payload.campaignName ? `Campagna: ${payload.campaignName}` : null,
  ]
}

function intakeChangedFields(params: {
  changedFields: string[]
}) {
  return Array.from(new Set(params.changedFields))
}

function intakeCreatedFields(params: {
  nameParts: ReturnType<typeof leadNameParts>
  emailNorm: string | null
  socialLeadId: string | null
  payload: LeadIntakePayload
  kwp: number | null
  kwh: number | null
  tipoDocumento: LeadIntakeTipoDocumento | null
  consensoTelefono: boolean | null
  consensoWhatsapp: boolean | null
  consensoEmail: boolean | null
}) {
  return [
    "Nome Lead",
    params.nameParts.nome ? "Nome" : null,
    params.nameParts.cognome ? "Cognome" : null,
    "Telefono",
    params.emailNorm ? "E-mail" : null,
    params.payload.provincia ? "Provincia" : null,
    params.payload.citta ? "Citta'" : null,
    params.payload.codicePostale ? "Codice postale" : null,
    params.socialLeadId ? "Social Lead ID" : null,
    params.payload.campaignName ? "campaign name" : null,
    "Origine Lead",
    params.kwp !== null ? "kWp" : null,
    params.kwh !== null ? "kWh accumulo" : null,
    params.payload.modelloPannello ? "Modello pannello" : null,
    params.payload.wallboxRichiesto !== undefined ? "Wallbox richiesto" : null,
    params.payload.residenteInSicilia !== undefined ? "Residente in Sicilia" : null,
    params.tipoDocumento ? "Tipo documento" : null,
    params.consensoTelefono !== null ? "Consenso telefono" : null,
    params.consensoWhatsapp !== null ? "Consenso WhatsApp" : null,
    params.consensoEmail !== null ? "Consenso e-mail" : null,
    "Ora ultima attivita'",
  ].filter((field): field is string => Boolean(field))
}

export interface LeadIntakeResult {
  id: string | null
  duplicate: boolean
  nomeLead: string
  skipped?: boolean
  skipReason?: string
  sourceCreatedAt?: string
}

type ExistingLead = {
  id: string
  nome_lead: string | null
  nome: string | null
  cognome: string | null
  email: string | null
  telefono: string | null
  provincia: string | null
  citta: string | null
  codice_postale: string | null
  social_lead_id: string | null
  campaign_name: string | null
  descrizione: string | null
  lead_proprietario_id: string | null
  valutazione: number | null
  kwp: number | null
  kwh: number | null
  modello_pannello: string | null
  wallbox_richiesto: boolean | null
  residente_in_sicilia: boolean | null
  tipo_documento: string | null
  consenso_contatto_telefono: boolean | null
  consenso_contatto_whatsapp: boolean | null
  consenso_contatto_email: boolean | null
}

const EXISTING_LEAD_SELECT = [
  "id",
  "nome_lead",
  "nome",
  "cognome",
  "email",
  "telefono",
  "provincia",
  "citta",
  "codice_postale",
  "social_lead_id",
  "campaign_name",
  "descrizione",
  "lead_proprietario_id",
  "valutazione",
  "kwp",
  "kwh",
  "modello_pannello",
  "wallbox_richiesto",
  "residente_in_sicilia",
  "tipo_documento",
  "consenso_contatto_telefono",
  "consenso_contatto_whatsapp",
  "consenso_contatto_email",
].join(", ")

async function findExistingLeadByExactField(
  supabase: SupabaseClient,
  column: "social_lead_id" | "telefono",
  value: string | null,
) {
  if (!value) return null

  const { data, error } = await supabase
    .from("leads")
    .select(EXISTING_LEAD_SELECT)
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`findExistingLead ${column}: ${error.message}`)
  return data as ExistingLead | null
}

async function findExistingLeadByEmail(
  supabase: SupabaseClient,
  emailNorm: string | null,
) {
  if (!emailNorm) return null

  const { data, error } = await supabase
    .from("leads")
    .select(EXISTING_LEAD_SELECT)
    .ilike("email", emailNorm)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`findExistingLead email: ${error.message}`)
  return data as ExistingLead | null
}

async function findExistingLeadBySimilarPhone(
  supabase: SupabaseClient,
  telefonoNorm: string,
) {
  const phoneKeys = leadPhoneMatchKeys(telefonoNorm)
  const suffix = phoneKeys
    .toSorted((left, right) => right.length - left.length)[0]
    ?.slice(-4)

  if (!suffix || suffix.length < 4) return null

  const { data, error } = await supabase
    .from("leads")
    .select(EXISTING_LEAD_SELECT)
    .ilike("telefono", `%${suffix}%`)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(`findExistingLead telefono simile: ${error.message}`)
  return ((data ?? []) as unknown as ExistingLead[]).find((lead) => phonesMatch(lead.telefono, telefonoNorm)) ?? null
}

async function findExistingLead(
  telefonoNorm: string,
  emailNorm: string | null,
  socialLeadId: string | null,
): Promise<ExistingLead | null> {
  const supabase = createAdminClient()
  if (!supabase) throw new Error("Supabase admin client non configurato")

  return (
    (await findExistingLeadByExactField(supabase, "social_lead_id", socialLeadId)) ??
    (await findExistingLeadByEmail(supabase, emailNorm)) ??
    (await findExistingLeadByExactField(supabase, "telefono", telefonoNorm)) ??
    (await findExistingLeadBySimilarPhone(supabase, telefonoNorm))
  )
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
  const sourceInfo = intakeSource(payload)
  const nameParts = leadNameParts(payload)
  const socialLeadId = normalizeText(payload.socialLeadId)
  const staleMetaLead = staleMetaLeadReason(payload, now)

  if (staleMetaLead) {
    console.info("[lead-intake] Meta lead ignorato per data sorgente vecchia", {
      nome: payload.nome,
      telefono: telefonoNorm,
      socialLeadId,
      sourceCreatedAt: staleMetaLead.sourceCreatedAt,
      maxAgeHours: staleMetaLead.maxAgeHours,
    })
    return {
      id: null,
      duplicate: false,
      nomeLead: payload.nome,
      skipped: true,
      skipReason: "stale_meta_lead",
      sourceCreatedAt: staleMetaLead.sourceCreatedAt,
    }
  }

  const existing = await findExistingLead(telefonoNorm, emailNorm, socialLeadId)

  if (existing) {
    const nextScore = Math.max(existing.valutazione ?? 0, calculatedScore)
    const timestamp = now.toLocaleString("it-IT", { timeZone: ROME_TIME_ZONE })
    const notaIngresso = `[${timestamp}] Nuovo contatto da ${ORIGINE_LABELS[payload.origine]}${
      description ? `:\n${description}` : ""
    }`
    const descrizioneAggiornata = existing.descrizione
      ? `${existing.descrizione}\n${notaIngresso}`
      : notaIngresso

    const changedFields = ["Descrizione", "Ora ultima attivita'"]
    if (nextScore !== (existing.valutazione ?? 0)) addChangedField(changedFields, "Valutazione")

    const updateRow: Record<string, unknown> = {
      descrizione: descrizioneAggiornata,
      valutazione: nextScore,
      ora_ultima_attivita: now.toISOString(),
      updated_at: now.toISOString(),
    }

    assignTextField(updateRow, existing, changedFields, "nome_lead", "Nome Lead", payload.nome)
    assignTextField(updateRow, existing, changedFields, "nome", "Nome", nameParts.nome)
    assignTextField(updateRow, existing, changedFields, "cognome", "Cognome", nameParts.cognome)
    assignTextField(updateRow, existing, changedFields, "telefono", "Telefono", telefonoNorm)
    assignTextField(updateRow, existing, changedFields, "email", "E-mail", emailNorm)
    assignTextField(updateRow, existing, changedFields, "provincia", "Provincia", payload.provincia)
    assignTextField(updateRow, existing, changedFields, "citta", "Citta'", payload.citta)
    assignTextField(updateRow, existing, changedFields, "codice_postale", "Codice postale", payload.codicePostale)
    assignTextField(updateRow, existing, changedFields, "social_lead_id", "Social Lead ID", socialLeadId)
    assignTextField(updateRow, existing, changedFields, "campaign_name", "campaign name", payload.campaignName)
    assignNumberField(updateRow, existing, changedFields, "kwp", "kWp", kwp)
    assignNumberField(updateRow, existing, changedFields, "kwh", "kWh accumulo", kwh)
    assignTextField(updateRow, existing, changedFields, "modello_pannello", "Modello pannello", payload.modelloPannello)
    assignBooleanField(
      updateRow,
      existing,
      changedFields,
      "wallbox_richiesto",
      "Wallbox richiesto",
      normalizeBoolean(payload.wallboxRichiesto),
    )
    assignBooleanField(
      updateRow,
      existing,
      changedFields,
      "residente_in_sicilia",
      "Residente in Sicilia",
      normalizeBoolean(payload.residenteInSicilia),
    )
    assignTextField(updateRow, existing, changedFields, "tipo_documento", "Tipo documento", tipoDocumento)
    assignBooleanField(
      updateRow,
      existing,
      changedFields,
      "consenso_contatto_telefono",
      "Consenso telefono",
      consensoTelefono,
    )
    assignBooleanField(
      updateRow,
      existing,
      changedFields,
      "consenso_contatto_whatsapp",
      "Consenso WhatsApp",
      consensoWhatsapp,
    )
    assignBooleanField(
      updateRow,
      existing,
      changedFields,
      "consenso_contatto_email",
      "Consenso e-mail",
      consensoEmail,
    )
    const updatedLeadName = normalizeText(updateRow.nome_lead) ?? existing.nome_lead ?? payload.nome

    const { error: updateError } = await supabase
      .from("leads")
      .update(updateRow)
      .eq("id", existing.id)

    if (updateError) throw new Error(`ingestLead update: ${updateError.message}`)
    await insertLeadUpdateActivity(supabase, {
      leadId: existing.id,
      text: buildLeadUpdateActivityText({
        source: sourceInfo.source,
        sourceDetail: sourceInfo.detail,
        reason: configuratorLead ? "preventivo_aggiornato" : "duplicato_aggiornato",
        changedFields: intakeChangedFields({ changedFields }),
        details: intakeReceivedDetails(payload),
        note: "Esito: lead gia' presente nel CRM, nessun duplicato creato.",
      }),
      logPrefix: "[lead-intake] attivita aggiornamento",
    })
    if (hasDiscountCode) {
      const tagId = await ensureLeadTag(supabase)
      await assignLeadTag(supabase, existing.id, tagId)
    }
    if (configuratorLead) {
      const tags = [
        CONFIGURATOR_TAGS.configuratore,
        CONFIGURATOR_TAGS.richiamare,
        CONFIGURATOR_TAGS.aggiornato,
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
        leadName: updatedLeadName,
        ownerId: existing.lead_proprietario_id,
        dueDate: recallDueDate(now),
        highPriority: calculatedScore >= 80,
        description: `Lead già presente: nuovo passaggio dal configuratore. Verificare dati aggiornati e richiamare per confermare il preventivo.`,
      })
    }

    return { id: existing.id, duplicate: true, nomeLead: updatedLeadName }
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      nome_lead: payload.nome,
      nome: nameParts.nome,
      cognome: nameParts.cognome,
      telefono: telefonoNorm,
      email: emailNorm || null,
      provincia: payload.provincia || null,
      citta: payload.citta || null,
      codice_postale: payload.codicePostale || null,
      social_lead_id: socialLeadId,
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
  await insertLeadUpdateActivity(supabase, {
    leadId: data.id as string,
    text: buildLeadUpdateActivityText({
      action: "creato",
      source: sourceInfo.source,
      sourceDetail: sourceInfo.detail,
      reason: "nuova_richiesta",
      changedFields: intakeCreatedFields({
        nameParts,
        emailNorm,
        socialLeadId,
        payload,
        kwp,
        kwh,
        tipoDocumento,
        consensoTelefono,
        consensoWhatsapp,
        consensoEmail,
      }),
      details: intakeReceivedDetails(payload),
      note: "Esito: nuovo lead creato nel CRM.",
    }),
    logPrefix: "[lead-intake] attivita creazione",
  })
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
      CONFIGURATOR_TAGS.nuovo,
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
