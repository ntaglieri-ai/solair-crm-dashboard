import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"
import { CLIENTI_ZOHO_FIELDS } from "./clienti-zoho-fields.mjs"

const execFileAsync = promisify(execFile)
const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const home = process.env.HOME ?? ""

const envPath = join(process.cwd(), ".env.local")
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator === -1) continue
    const key = trimmed.slice(0, separator)
    const value = trimmed.slice(separator + 1)
    process.env[key] ??= value
  }
}

function argument(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const inputZip = argument("input", `${home}/Downloads/Clienti_2026_07_07.zip`)

function nullable(value) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function booleanValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (["true", "vero", "yes", "si", "sì", "1"].includes(normalized)) return true
  if (["false", "falso", "no", "0"].includes(normalized)) return false
  return null
}

function numberValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function timestampValue(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const italianDate = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (italianDate) {
    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = italianDate
    const parsed = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${hh.padStart(2, "0")}:${mi}:${ss}+02:00`)
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
  }
  const withOffsetColon = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const isoLike = withOffsetColon.includes("T") ? withOffsetColon : withOffsetColon.replace(" ", "T")
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
  const parsed = new Date(hasTimezone ? isoLike : `${isoLike}Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

function typedValue(field, value) {
  if (field.column === "zoho_record_id" || field.column.endsWith("_zoho_id")) {
    return normalizeZohoId(value) || null
  }
  if (field.type === "boolean") return booleanValue(value)
  if (field.type === "numeric") return numberValue(value)
  if (field.type === "timestamp") return timestampValue(value)
  return nullable(value)
}

async function readZipCsv(zipPath) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  })
  return parse(stdout, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
}

function rowToCliente(row) {
  const cliente = {}
  for (const field of CLIENTI_ZOHO_FIELDS) {
    cliente[field.column] = typedValue(field, row[field.zoho])
  }
  cliente.nome_clienti = cliente.nome_clienti ?? nullable(row["Clienti Name"])
  cliente.email = cliente.email ?? nullable(row["E-mail"])
  cliente.nome = cliente.nome ?? nullable(row.Nome)
  cliente.cognome = cliente.cognome ?? nullable(row.Cognome)
  cliente.cellulare = cliente.cellulare ?? nullable(row.Cellulare)
  cliente.codice_fiscale = cliente.codice_fiscale ?? nullable(row["Codice fiscale"])
  cliente.stato = cliente.stato ?? nullable(row.Stato)
  cliente.created_at = cliente.ora_creazione ?? undefined
  cliente.updated_at = cliente.zoho_modified_at ?? cliente.ora_modifica ?? new Date().toISOString()
  return cliente
}

async function chunks(values, size, callback) {
  for (let index = 0; index < values.length; index += size) {
    await callback(values.slice(index, index + size))
  }
}

async function fetchExistingClientiIds(zohoIds) {
  const existing = new Map()
  await chunks(zohoIds, 500, async (batch) => {
    const { data, error } = await supabase
      .from("clienti")
      .select("id,zoho_record_id")
      .in("zoho_record_id", batch)
    if (error) throw new Error(`fetch clienti esistenti: ${error.message}`)
    for (const row of data ?? []) {
      if (row.zoho_record_id) existing.set(row.zoho_record_id, row.id)
    }
  })
  return existing
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const sourceRows = await readZipCsv(inputZip)
const rows = sourceRows.map(rowToCliente).filter((row) => row.zoho_record_id)

console.log(`Clienti Zoho letti: ${sourceRows.length}`)
console.log(`Clienti importabili con ID record: ${rows.length}`)

if (!apply) {
  console.log("Dry run completato. Aggiungi --apply per scrivere su Supabase.")
  process.exit(0)
}

const existingByZohoId = await fetchExistingClientiIds(
  rows.map((row) => row.zoho_record_id),
)
const toInsert = []
const toUpdate = []

for (const row of rows) {
  const id = existingByZohoId.get(row.zoho_record_id)
  if (id) {
    toUpdate.push({ id, row })
  } else {
    toInsert.push(row)
  }
}

await chunks(toInsert, 300, async (batch) => {
  if (batch.length === 0) return
  const { error } = await supabase.from("clienti").insert(batch)
  if (error) throw new Error(`insert clienti: ${error.message}`)
})

await chunks(toUpdate, 100, async (batch) => {
  await Promise.all(
    batch.map(async ({ id, row }) => {
      const { error } = await supabase
        .from("clienti")
        .update(row)
        .eq("id", id)
      if (error) throw new Error(`update cliente ${id}: ${error.message}`)
    }),
  )
})

console.log(
  `Import completato: ${rows.length} clienti (${toInsert.length} nuovi, ${toUpdate.length} aggiornati).`,
)
