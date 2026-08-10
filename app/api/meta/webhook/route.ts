import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse, after } from "next/server"
import { ensureFolder } from "@/lib/nextcloud/admin-webdav"
import { folderPathForRecord } from "@/lib/allegati/paths"
import {
  ingestLead,
  type LeadIntakePayload,
} from "@/lib/leads/public-intake"

export const runtime = "nodejs"

type MetaLeadgenValue = {
  leadgen_id?: string | number
  page_id?: string | number
  form_id?: string | number
  ad_id?: string | number
  adgroup_id?: string | number
  created_time?: string | number
}

type MetaLeadgenEvent = {
  leadgenId: string
  pageId: string | null
  formId: string | null
  adId: string | null
  adgroupId: string | null
  createdTime: string | number | null
}

type MetaLeadField = {
  name?: string
  values?: unknown[]
}

type MetaCustomDisclaimerResponse = {
  checkbox_key?: string
  key?: string
  name?: string
  text?: string
  response?: unknown
  values?: unknown[]
}

type MetaLeadResponse = {
  id?: string
  created_time?: string
  ad_id?: string
  form_id?: string
  field_data?: MetaLeadField[]
  custom_disclaimer_responses?: MetaCustomDisclaimerResponse[]
}

type FieldMap = Record<string, string>

const DEFAULT_GRAPH_API_VERSION = "v21.0"

export async function GET(request: Request) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    return NextResponse.json(
      { error: "META_WEBHOOK_VERIFY_TOKEN non configurato" },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return NextResponse.json({ error: "Verifica Meta non valida" }, { status: 403 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signatureCheck = verifySignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
  )

  if (!signatureCheck.ok) {
    return NextResponse.json(
      { error: signatureCheck.error },
      { status: signatureCheck.status },
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Body non valido, atteso JSON" }, { status: 400 })
  }

  const events = extractLeadgenEvents(payload)

  if (events.length > 0) {
    after(async () => {
      await Promise.allSettled(events.map((event) => processLeadgenEvent(event)))
    })
  }

  return NextResponse.json({ received: true, events: events.length })
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    return {
      ok: false,
      status: 503,
      error: "META_APP_SECRET non configurato",
    }
  }
  if (!signatureHeader?.startsWith("sha256=")) {
    return { ok: false, status: 401, error: "Firma Meta mancante" }
  }

  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")}`
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(signatureHeader)

  if (expectedBuffer.length !== providedBuffer.length) {
    return { ok: false, status: 401, error: "Firma Meta non valida" }
  }
  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { ok: false, status: 401, error: "Firma Meta non valida" }
  }
  return { ok: true, status: 200, error: null }
}

function extractLeadgenEvents(payload: unknown): MetaLeadgenEvent[] {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) return []

  const events: MetaLeadgenEvent[] = []

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue

    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "leadgen") continue
      if (!isRecord(change.value)) continue

      const value = change.value as MetaLeadgenValue
      const leadgenId = stringifyId(value.leadgen_id)
      if (!leadgenId) continue

      events.push({
        leadgenId,
        pageId: stringifyId(value.page_id),
        formId: stringifyId(value.form_id),
        adId: stringifyId(value.ad_id),
        adgroupId: stringifyId(value.adgroup_id),
        createdTime: value.created_time ?? null,
      })
    }
  }

  return events
}

async function processLeadgenEvent(event: MetaLeadgenEvent) {
  try {
    const token = getPageAccessToken(event.pageId)
    const metaLead = await fetchMetaLead(event.leadgenId, token)
    const intakePayload = mapMetaLeadToIntakePayload(metaLead, event)

    if (!intakePayload.nome || !intakePayload.telefono) {
      console.error("[meta/webhook] Lead Meta senza nome o telefono", {
        leadgenId: event.leadgenId,
        fields: metaLead.field_data?.map((field) => field.name),
      })
      return
    }

    const result = await ingestLead(intakePayload)

    if (!result.duplicate) {
      const path = folderPathForRecord("lead", result.id, result.nomeLead)
      const folderResult = await ensureFolder(path)
      if (!folderResult.ok) {
        console.error(
          `[meta/webhook] creazione cartella lead ${result.id} fallita:`,
          folderResult.error,
        )
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore gestione lead Meta"
    console.error("[meta/webhook]", message, { leadgenId: event.leadgenId })
  }
}

async function fetchMetaLead(leadgenId: string, accessToken: string): Promise<MetaLeadResponse> {
  const graphVersion =
    process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${leadgenId}`)
  url.searchParams.set(
    "fields",
    "created_time,id,ad_id,form_id,field_data,custom_disclaimer_responses",
  )
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url, { cache: "no-store" })
  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const detail =
      isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
        ? body.error.message
        : `HTTP ${response.status}`
    throw new Error(`Meta Graph API lead ${leadgenId}: ${detail}`)
  }

  if (!isRecord(body)) throw new Error(`Risposta Meta non valida per ${leadgenId}`)
  return body as MetaLeadResponse
}

function getPageAccessToken(pageId: string | null) {
  const tokenMap = readPageTokenMap()
  if (pageId && tokenMap[pageId]) return tokenMap[pageId]

  const fallback = process.env.META_PAGE_ACCESS_TOKEN?.trim()
  if (fallback) return fallback

  throw new Error(
    pageId
      ? `Page Access Token non configurato per pagina Meta ${pageId}`
      : "META_PAGE_ACCESS_TOKEN non configurato",
  )
}

function readPageTokenMap(): Record<string, string> {
  const raw = process.env.META_PAGE_ACCESS_TOKENS_JSON
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    )
  } catch {
    console.error("[meta/webhook] META_PAGE_ACCESS_TOKENS_JSON non e' JSON valido")
    return {}
  }
}

function mapMetaLeadToIntakePayload(
  metaLead: MetaLeadResponse,
  event: MetaLeadgenEvent,
): LeadIntakePayload {
  const fields = flattenFieldData(metaLead.field_data)
  const rawFields = flattenFieldData(metaLead.field_data, false)
  const disclaimerFields = flattenDisclaimerResponses(metaLead.custom_disclaimer_responses)
  const consensi = resolveContactConsents(fields, disclaimerFields)

  const nome =
    pick(fields, ["full_name", "nome", "nome_e_cognome", "name"]) ||
    [pick(fields, ["first_name", "nome_di_battesimo"]), pick(fields, ["last_name", "cognome"])]
      .filter(Boolean)
      .join(" ") ||
    `Lead Meta ${event.leadgenId}`

  const telefono = pick(fields, [
    "phone_number",
    "phone",
    "telefono",
    "mobile_phone",
    "cellulare",
    "numero_di_telefono",
  ])
  const email = pick(fields, ["email", "e_mail", "indirizzo_email"])
  const citta = pick(fields, ["city", "citta", "comune"])
  const provincia = pick(fields, ["state", "province", "provincia"])
  const tipoProprieta = normalizeTipoProprieta(
    pick(fields, ["tipo_proprieta", "tipo_di_proprieta", "property_type"]),
  )

  return {
    origine: "meta_ads",
    nome,
    telefono: telefono ?? "",
    email,
    citta,
    provincia,
    tipoProprieta,
    consensoTelefono: consensi.telefono,
    consensoWhatsapp: consensi.whatsapp,
    consensoEmail: consensi.email,
    note: buildNote(metaLead, event, rawFields),
  }
}

function flattenFieldData(fieldData: MetaLeadField[] | undefined, normalize = true): FieldMap {
  const fields: FieldMap = {}

  for (const field of fieldData ?? []) {
    if (!field.name || !Array.isArray(field.values)) continue
    const key = normalize ? normalizeFieldName(field.name) : field.name
    const values = field.values
      .map((value) => (value == null ? "" : String(value).trim()))
      .filter(Boolean)
    if (key && values.length > 0) fields[key] = values.join(", ")
  }

  return fields
}

function flattenDisclaimerResponses(
  responses: MetaCustomDisclaimerResponse[] | undefined,
): FieldMap {
  const fields: FieldMap = {}

  for (const response of responses ?? []) {
    const rawName =
      response.checkbox_key ??
      response.key ??
      response.name ??
      response.text
    if (!rawName) continue

    const key = normalizeFieldName(rawName)
    const values = Array.isArray(response.values)
      ? response.values
      : response.response !== undefined
        ? [response.response]
        : ["accepted"]
    const value = values
      .map((item) => (item == null ? "" : String(item).trim()))
      .filter(Boolean)
      .join(", ")

    if (key && value) fields[key] = value
  }

  return fields
}

function resolveContactConsents(fields: FieldMap, disclaimerFields: FieldMap) {
  return {
    telefono: parseConsent(
      pick(fields, [
        "consenso_telefono",
        "consenso_contatto_telefono",
        "contatto_telefono",
        "telefono",
        "chiamata",
        "chiamami",
      ]) ??
        pick(disclaimerFields, [
          "consenso_telefono",
          "consenso_contatto_telefono",
          "contatto_telefono",
          "telefono",
          "chiamata",
          "chiamami",
        ]),
    ),
    whatsapp: parseConsent(
      pick(fields, ["consenso_whatsapp", "consenso_contatto_whatsapp", "whatsapp", "contatto_whatsapp"]) ??
        pick(disclaimerFields, [
          "consenso_whatsapp",
          "consenso_contatto_whatsapp",
          "whatsapp",
          "contatto_whatsapp",
        ]),
    ),
    email: parseConsent(
      pick(fields, [
        "consenso_email",
        "consenso_e_mail",
        "consenso_contatto_email",
        "consenso_marketing_email",
        "marketing_email",
        "newsletter",
        "email",
      ]) ??
        pick(disclaimerFields, [
          "consenso_email",
          "consenso_e_mail",
          "consenso_contatto_email",
          "consenso_marketing_email",
          "marketing_email",
          "newsletter",
          "email",
        ]),
    ),
  }
}

function buildNote(
  metaLead: MetaLeadResponse,
  event: MetaLeadgenEvent,
  rawFields: FieldMap,
) {
  const metadata = [
    `Leadgen ID: ${event.leadgenId}`,
    event.pageId ? `Page ID: ${event.pageId}` : null,
    metaLead.form_id || event.formId ? `Form ID: ${metaLead.form_id ?? event.formId}` : null,
    metaLead.ad_id || event.adId ? `Ad ID: ${metaLead.ad_id ?? event.adId}` : null,
    event.adgroupId ? `Adgroup ID: ${event.adgroupId}` : null,
    metaLead.created_time || event.createdTime
      ? `Creato Meta: ${metaLead.created_time ?? event.createdTime}`
      : null,
  ].filter(Boolean)

  const answers = Object.entries(rawFields)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ")

  return [metadata.join("\n"), answers ? `Risposte form: ${answers}` : null]
    .filter(Boolean)
    .join("\n\n")
}

function pick(fields: FieldMap, names: string[]) {
  for (const name of names) {
    const value = fields[normalizeFieldName(name)]
    if (value) return value
  }
  return undefined
}

function normalizeFieldName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normalizeTipoProprieta(value: string | undefined) {
  if (!value) return undefined
  const normalized = normalizeFieldName(value)
  if (normalized.includes("commercial")) return "commerciale"
  if (normalized.includes("privat") || normalized.includes("residen")) return "privata"
  return undefined
}

function parseConsent(value: string | undefined) {
  if (!value) return undefined
  return ["1", "true", "yes", "si", "ok", "accepted", "accetto"].includes(
    value.trim().toLowerCase(),
  )
}

function stringifyId(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") return String(value)
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
