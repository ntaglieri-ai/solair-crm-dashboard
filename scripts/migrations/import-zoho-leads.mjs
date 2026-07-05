import { execFile } from "node:child_process"
import process from "node:process"
import { promisify } from "node:util"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

const execFileAsync = promisify(execFile)
const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const home = process.env.HOME ?? ""

function argument(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const inputZip = argument("input", `${home}/Downloads/Lead_2026_07_04.zip`)
const baselineZip = argument("baseline", `${home}/Downloads/Leads_2026_06_27.zip`)
const baselineMigration = argument(
  "baseline-migration",
  `${home}/Downloads/leads_migrazione.csv`,
)

const signatureFields = [
  "nome",
  "cognome",
  "nome_lead",
  "email",
  "telefono",
  "mobile_fisso",
  "social_lead_id",
  "residente_in_sicilia",
  "citta",
  "provincia",
  "codice_postale",
  "paese",
  "stato_lead",
  "valutazione",
  "origine_lead",
  "campaign_name",
  "descrizione",
  "data_sopralluogo",
  "data_click",
  "data_ora",
  "ora_ultima_attivita",
  "creato_da",
]

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function nullable(value) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

function booleanValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  return ["true", "vero", "yes", "si", "sì", "1"].includes(normalized)
}

function numberValue(value) {
  const normalized = String(value ?? "").trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function timestampValue(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const withOffsetColon = normalized.replace(
    /([+-]\d{2})(\d{2})$/,
    "$1:$2",
  )
  const isoLike = withOffsetColon.includes("T")
    ? withOffsetColon
    : withOffsetColon.replace(" ", "T")
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
  const parsed = new Date(hasTimezone ? isoLike : `${isoLike}Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function tagKey(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("it")
}

function tagsFromRow(row) {
  return String(row.Tag ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

async function readZipCsv(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  })
  return parse(stdout, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
}

async function readCsv(path) {
  const { stdout } = await execFileAsync("cat", [path], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  })
  return parse(stdout, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
}

function signatureValue(field, value) {
  if (value === null || value === undefined || value === "") return null
  if (field === "residente_in_sicilia") return booleanValue(value)
  if (field === "valutazione") return numberValue(value)
  if (
    ["data_sopralluogo", "data_click", "data_ora", "ora_ultima_attivita"].includes(field)
  ) {
    return timestampValue(value)
  }
  return String(value).trim()
}

function signature(row) {
  return JSON.stringify(
    signatureFields.map((field) => signatureValue(field, row[field])),
  )
}

function sourceToLead(row, ownerIds, seenAt) {
  const zohoOwnerId = normalizeZohoId(row["Lead Proprietario.id"])
  const modifiedAt = timestampValue(row["Orario del registro delle modifiche"])

  return {
    zoho_id: normalizeZohoId(row["ID record"]),
    zoho_owner_id: zohoOwnerId || null,
    zoho_creato_da_id: normalizeZohoId(row["Creato da.id"]) || null,
    zoho_account_convertito_id:
      normalizeZohoId(row["Account convertito.id"]) || null,
    zoho_contatto_convertito_id:
      normalizeZohoId(row["Contatto convertito.id"]) || null,
    zoho_installatore_sopralluogo_id:
      normalizeZohoId(row["Installatore - Incaricato sopralluogo.id"]) || null,
    zoho_connesso_a_id: normalizeZohoId(row["Connesso a.id"]) || null,
    zoho_modified_at: modifiedAt,
    zoho_last_seen_at: seenAt,
    nome: nullable(row.Nome),
    cognome: nullable(row.Cognome),
    nome_lead: nullable(row["Lead Name"]),
    email: nullable(row["E-mail"]),
    telefono: nullable(row.Telefono),
    mobile_fisso: nullable(row["Mobile/Fisso"]),
    social_lead_id: nullable(row["Social Lead ID"]),
    residente_in_sicilia: booleanValue(row["Residente in Sicilia"]),
    citta: nullable(row["Città"]),
    provincia: nullable(row.Provincia),
    codice_postale: nullable(row["Codice postale"]),
    paese: nullable(row.Paese),
    stato_lead: nullable(row["Stato Lead"]),
    stato_email: nullable(row.Stato),
    valutazione: numberValue(row.Valutazione),
    lead_proprietario_id: ownerIds.get(zohoOwnerId) ?? null,
    origine_lead: nullable(row["Origine Lead"]),
    campaign_name: nullable(row["campaign name"]),
    descrizione: nullable(row.Descrizione),
    saluti: nullable(row.Saluti),
    data_sopralluogo: timestampValue(row["Data sopralluogo"]),
    tempo_conversione_lead: nullable(row["Tempo di conversione Lead"]),
    contatto_convertito: nullable(row["Contatto convertito"]),
    modalita_iscrizione_annullata: nullable(row["Modalità iscrizione annullata"]),
    ora_iscrizione_annullata: timestampValue(row["Ora  iscrizione annullata"]),
    connesso_a: nullable(row["Connected To.module"]),
    creato_da: nullable(row["Creato da"]),
    data_click: timestampValue(row["Data Click"]),
    data_ora: timestampValue(row["Data/Ora"]),
    ora_ultima_attivita: timestampValue(row["Ora ultima attività"]),
    convertito: booleanValue(row["è convertito"]),
    bloccato: booleanValue(row.Locked),
    created_at: timestampValue(row["Ora creazione"]),
    updated_at: modifiedAt ?? timestampValue(row["Ora ultima attività"]),
  }
}

async function fetchAll(supabase, table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function fetchLeadRows(supabase) {
  try {
    return await fetchAll(
      supabase,
      "leads",
      ["id", "zoho_id", "zoho_modified_at", ...signatureFields].join(","),
    )
  } catch (error) {
    if (!String(error).includes("zoho_id")) throw error
    const rows = await fetchAll(
      supabase,
      "leads",
      ["id", ...signatureFields].join(","),
    )
    return rows.map((row) => ({ ...row, zoho_id: null }))
  }
}

async function chunks(values, size, callback) {
  for (let index = 0; index < values.length; index += size) {
    await callback(values.slice(index, index + size))
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const [sourceRows, baselineSourceRows, baselineMigrationRows, users, dbRows] =
  await Promise.all([
    readZipCsv(inputZip),
    readZipCsv(baselineZip),
    readCsv(baselineMigration),
    fetchAll(supabase, "utenti", "id,zoho_id"),
    fetchLeadRows(supabase),
  ])

if (baselineSourceRows.length !== baselineMigrationRows.length) {
  throw new Error("Baseline Zoho e CSV di migrazione non hanno la stessa lunghezza.")
}

const ownerIds = new Map(
  users
    .filter((user) => user.zoho_id)
    .map((user) => [user.zoho_id, user.id]),
)
const dbIdByZohoId = new Map(
  dbRows.filter((row) => row.zoho_id).map((row) => [row.zoho_id, row.id]),
)
const dbById = new Map(dbRows.map((row) => [row.id, row]))
const dbIdsBySignature = new Map()
for (const row of dbRows.filter((item) => !item.zoho_id)) {
  const key = signature(row)
  if (dbIdsBySignature.has(key)) {
    throw new Error("Firma Lead duplicata in Supabase: associazione non sicura.")
  }
  dbIdsBySignature.set(key, row.id)
}

const baselineIdBySignature = new Map()
for (let index = 0; index < baselineSourceRows.length; index += 1) {
  const key = signature(baselineMigrationRows[index])
  if (baselineIdBySignature.has(key)) {
    throw new Error("Firma Lead duplicata nella baseline: associazione non sicura.")
  }
  baselineIdBySignature.set(
    key,
    normalizeZohoId(baselineSourceRows[index]["ID record"]),
  )
}

for (const [key, zohoId] of baselineIdBySignature) {
  const dbId = dbIdsBySignature.get(key)
  if (dbId) dbIdByZohoId.set(zohoId, dbId)
}

const sourceIds = new Set()
for (const row of sourceRows) {
  const id = normalizeZohoId(row["ID record"])
  if (!id) throw new Error("Lead senza ID record.")
  if (sourceIds.has(id)) throw new Error(`ID Zoho duplicato: ${id}`)
  sourceIds.add(id)
}

const baselineIds = new Set(
  baselineSourceRows.map((row) => normalizeZohoId(row["ID record"])),
)
const seenAt = new Date().toISOString()
const importRows = sourceRows.map((row) => {
  const lead = sourceToLead(row, ownerIds, seenAt)
  const id = dbIdByZohoId.get(lead.zoho_id)
  return id ? { id, ...lead } : lead
})
const existingRows = importRows.filter((row) => row.id)
const newRows = importRows.filter((row) => !row.id)
const changedRows = existingRows.filter((row) => {
  const current = dbById.get(row.id)
  return timestampValue(current?.zoho_modified_at) !== row.zoho_modified_at
})
const changedIds = new Set(changedRows.map((row) => row.id))
const unchangedRows = existingRows.filter((row) => !changedIds.has(row.id))
const missingBaselineIds = [...baselineIds].filter((id) => !sourceIds.has(id))
const unresolvedOwners = new Set(
  sourceRows
    .map((row) => normalizeZohoId(row["Lead Proprietario.id"]))
    .filter((id) => id && !ownerIds.has(id)),
)

const tags = new Map()
for (const row of sourceRows) {
  for (const tag of tagsFromRow(row)) {
    const key = tagKey(tag)
    if (key && !tags.has(key)) tags.set(key, tag)
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      source: sourceRows.length,
      currentDatabase: dbRows.length,
      matchedExisting: existingRows.length,
      unchanged: unchangedRows.length,
      toUpdate: changedRows.length,
      toInsert: newRows.length,
      noLongerInExport: missingBaselineIds.length,
      ownersResolved: ownerIds.size,
      unresolvedOwnerIds: [...unresolvedOwners],
      distinctTags: tags.size,
    },
    null,
    2,
  ),
)

if (!apply) {
  console.log("Dry-run completato. Nessun dato scritto su Supabase.")
  process.exit(0)
}

await chunks(changedRows, 250, async (batch) => {
  const { error } = await supabase.from("leads").upsert(batch, {
    onConflict: "id",
  })
  if (error) throw new Error(`Aggiornamento Lead: ${error.message}`)
})

await chunks(unchangedRows, 250, async (batch) => {
  const heartbeat = batch.map((row) => ({
    id: row.id,
    zoho_id: row.zoho_id,
    zoho_last_seen_at: seenAt,
  }))
  const { error } = await supabase.from("leads").upsert(heartbeat, {
    onConflict: "id",
  })
  if (error) throw new Error(`Verifica Lead invariati: ${error.message}`)
})

const insertedByZohoId = new Map()
await chunks(newRows, 250, async (batch) => {
  const { data, error } = await supabase
    .from("leads")
    .insert(batch)
    .select("id,zoho_id")
  if (error) throw new Error(`Inserimento Lead: ${error.message}`)
  for (const row of data ?? []) insertedByZohoId.set(row.zoho_id, row.id)
})

const missingExistingRows = baselineSourceRows
  .filter((row) => missingBaselineIds.includes(normalizeZohoId(row["ID record"])))
  .map((row) => {
    const zohoId = normalizeZohoId(row["ID record"])
    const id = dbIdByZohoId.get(zohoId)
    return id
      ? {
          id,
          zoho_id: zohoId,
          zoho_owner_id: normalizeZohoId(row["Lead Proprietario.id"]) || null,
          lead_proprietario_id:
            ownerIds.get(normalizeZohoId(row["Lead Proprietario.id"])) ?? null,
        }
      : null
  })
  .filter(Boolean)

if (missingExistingRows.length > 0) {
  const { error } = await supabase.from("leads").upsert(missingExistingRows, {
    onConflict: "id",
  })
  if (error) throw new Error(`Identificazione Lead non esportati: ${error.message}`)
}

const existingTagRows = await fetchAll(supabase, "tag", "id,nome,modulo")
const tagIds = new Map(
  existingTagRows
    .filter((tag) => tag.modulo === "lead")
    .map((tag) => [tagKey(tag.nome), tag.id]),
)
const missingTags = [...tags]
  .filter(([chiave]) => !tagIds.has(chiave))
  .map(([, nome]) => ({
    nome,
    colore: "#64748b",
    modulo: "lead",
  }))

await chunks(missingTags, 250, async (batch) => {
  const { data, error } = await supabase
    .from("tag")
    .insert(batch)
    .select("id,nome")
  if (error) throw new Error(`Importazione tag: ${error.message}`)
  for (const tag of data ?? []) tagIds.set(tagKey(tag.nome), tag.id)
})

const leadIds = new Map([...dbIdByZohoId, ...insertedByZohoId])
const assignments = []
for (const row of sourceRows) {
  const leadId = leadIds.get(normalizeZohoId(row["ID record"]))
  if (!leadId) throw new Error("UUID Lead non risolto durante i tag.")
  for (const tag of tagsFromRow(row)) {
    const tagId = tagIds.get(tagKey(tag))
    if (tagId) assignments.push({ lead_id: leadId, tag_id: tagId })
  }
}

const { error: clearTagsError } = await supabase
  .from("lead_tags")
  .delete()
  .not("lead_id", "is", null)
if (clearTagsError) throw new Error(`Pulizia tag Lead: ${clearTagsError.message}`)

await chunks(assignments, 500, async (batch) => {
  const { error } = await supabase
    .from("lead_tags")
    .upsert(batch, { onConflict: "lead_id,tag_id" })
  if (error) throw new Error(`Assegnazione tag Lead: ${error.message}`)
})

console.log(
  JSON.stringify(
    {
      updated: existingRows.length,
      inserted: newRows.length,
      identifiedOutsideExport: missingExistingRows.length,
      tags: tags.size,
      tagAssignments: assignments.length,
      invitationsSent: 0,
    },
    null,
    2,
  ),
)
