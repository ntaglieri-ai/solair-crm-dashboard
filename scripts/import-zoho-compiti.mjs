import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const DEFAULT_ZIP = "/Users/imacnando/Downloads/Compiti_2026_07_07.zip"
const zipPath = process.argv[2] ?? DEFAULT_ZIP

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local")
  const env = {}
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
  return env
}

function unzipCsv(filePath) {
  const list = spawnSync("unzip", ["-Z1", filePath], { encoding: "utf8" })
  if (list.status !== 0) throw new Error(list.stderr || "Zip non leggibile")
  const csvName = list.stdout
    .split(/\r?\n/)
    .find((name) => name.toLowerCase().endsWith(".csv"))
  if (!csvName) throw new Error("Nessun CSV trovato nello zip")

  const out = spawnSync("unzip", ["-p", filePath, csvName], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  })
  if (out.status !== 0) throw new Error(out.stderr || "CSV non estraibile")
  return out.stdout.replace(/^\uFEFF/, "")
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""))
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += ch
    }
  }

  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }

  const headers = rows.shift() ?? []
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) =>
      Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])),
    )
}

function toTimestamp(value) {
  const raw = value?.trim()
  if (!raw) return null
  const isoLike = raw.includes("T") ? raw : raw.replace(" ", "T")
  const date = new Date(isoLike)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function toDueDate(value) {
  const raw = value?.trim()
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function clean(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizePriority(value) {
  const priority = clean(value)
  if (priority === "Altissimo") return "Alto"
  if (priority === "Normale") return "Medio"
  if (priority === "Bassissimo") return "Basso"
  return priority ?? "Medio"
}

function mapRow(row) {
  return {
    zoho_record_id: clean(row["ID record"]),
    proprietario_zoho_id: clean(row["Proprietario del compito.id"]),
    proprietario_nome: clean(row["Proprietario del compito"]),
    oggetto: clean(row.Oggetto),
    scadenza: toDueDate(row["Data di scadenza"]),
    nome_contatto_zoho_id: clean(row["Nome contatto.id"]),
    nome_contatto: clean(row["Nome contatto"]),
    correlato_zoho_id: clean(row["Correlato a.id"]),
    correlato_nome: clean(row["Correlato a"]),
    correlato_tipo: clean(row["Correlato a"]) ? "cliente" : null,
    stato: clean(row.Stato) ?? "Non iniziato",
    priorita: normalizePriority(row["Priorità"]),
    ripeti: clean(row.Ripeti),
    promemoria: toTimestamp(row.Promemoria),
    creato_da_zoho_id: clean(row["Creato da.id"]),
    creato_da_nome: clean(row["Creato da"]),
    modificato_da_zoho_id: clean(row["Modificato da.id"]),
    modificato_da_nome: clean(row["Modificato da"]),
    ora_creazione: toTimestamp(row["Ora creazione"]),
    ora_modifica: toTimestamp(row["Ora modifica"]),
    descrizione: clean(row.Descrizione),
    orario_chiusura: toTimestamp(row["Orario di chiusura"]),
    tag: clean(row.Tag),
    locked: row.Locked?.trim().toLowerCase() === "true",
    ora_ultima_attivita: toTimestamp(row["Ora ultima attività"]),
  }
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti")
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const csv = unzipCsv(zipPath)
const rows = parseCsv(csv).map(mapRow).filter((row) => row.zoho_record_id)
const chunkSize = 500
let replaced = 0

for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize)
  const ids = chunk.map((row) => row.zoho_record_id)
  const deleteResult = await supabase
    .from("compiti")
    .delete()
    .in("zoho_record_id", ids)
  if (deleteResult.error) throw new Error(deleteResult.error.message)

  const insertResult = await supabase
    .from("compiti")
    .insert(chunk)
  if (insertResult.error) throw new Error(insertResult.error.message)
  replaced += chunk.length
  process.stdout.write(`Importati ${replaced}/${rows.length}\r`)
}

process.stdout.write(`\nCompiti importati/allineati: ${replaced}\n`)
