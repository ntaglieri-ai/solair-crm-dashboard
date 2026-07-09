// Import/allineamento Scadenze da export Zoho CSV.
// Idempotente via scadenze.zoho_id (colonna aggiunta in
// supabase/migrations/20260709_scadenze_zoho_import.sql): upsert su
// onConflict "zoho_id" preserva lo uuid interno, quindi non rompe eventuali
// compiti.correlato_id già collegati a una scadenza.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_CSV = path.join(scriptDir, "data", "Scadenze_2026_07_09.csv")
const csvPath = process.argv[2] ?? DEFAULT_CSV

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function clean(value) {
  const trimmed = String(value ?? "").trim()
  return trimmed || null
}

function toTimestamp(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const isoLike = raw.includes("T") ? raw : raw.replace(" ", "T")
  const date = new Date(`${isoLike}Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// "Connected To.module" → connesso_a_tipo. Sempre vuoto nell'export attuale
// (8/8 righe), ma pronto per quando un delta futuro lo popolerà.
function moduleToTipo(moduleValue) {
  const raw = clean(moduleValue)
  if (raw === "Leads") return "lead"
  if (raw === "Clienti") return "cliente"
  return null
}

async function resolveConnessoA(supabase, moduleValue, connessoIdRaw) {
  const tipo = moduleToTipo(moduleValue)
  const zohoId = normalizeZohoId(connessoIdRaw)
  if (!tipo || !zohoId) return { connesso_a_id: null, connesso_a_tipo: null }

  if (tipo === "lead") {
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("zoho_id", zohoId)
      .maybeSingle()
    return { connesso_a_id: data?.id ?? null, connesso_a_tipo: data ? "lead" : null }
  }
  const { data } = await supabase
    .from("clienti")
    .select("id")
    .eq("zoho_record_id", zohoId)
    .maybeSingle()
  return { connesso_a_id: data?.id ?? null, connesso_a_tipo: data ? "cliente" : null }
}

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

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in .env.local")
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const csvText = fs.readFileSync(csvPath, "utf8")
const rows = parse(csvText, {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,
})

const { data: utenti, error: utentiError } = await supabase
  .from("utenti")
  .select("id,zoho_id,nome")
if (utentiError) throw new Error(`Lettura utenti: ${utentiError.message}`)
const ownerByZohoId = new Map(
  (utenti ?? []).filter((u) => u.zoho_id).map((u) => [u.zoho_id, u]),
)

const unresolvedOwners = new Set()
let ownersResolved = 0

const mapped = []
for (const row of rows) {
  const zohoId = normalizeZohoId(row["ID record"])
  if (!zohoId) throw new Error("Riga Scadenze senza 'ID record'")

  const ownerZohoId = normalizeZohoId(row["Proprietario di Scadenze.id"])
  const owner = ownerZohoId ? ownerByZohoId.get(ownerZohoId) : undefined
  if (ownerZohoId && owner) ownersResolved += 1
  else if (ownerZohoId) unresolvedOwners.add(ownerZohoId)

  const connessoA = await resolveConnessoA(
    supabase,
    row["Connected To.module"],
    row["Connesso a.id"],
  )

  mapped.push({
    zoho_id: zohoId,
    nome: clean(row["Nome Scadenze"]),
    data_scadenza: toTimestamp(row["Data scadenza"]),
    proprietario_id: owner?.id ?? null,
    proprietario_nome: owner?.nome ?? clean(row["Proprietario di Scadenze"]),
    descrizione: clean(row.Descrizione),
    connesso_a_id: connessoA.connesso_a_id,
    connesso_a_tipo: connessoA.connesso_a_tipo,
    updated_at: new Date().toISOString(),
  })
}

const { error: upsertError, data: upserted } = await supabase
  .from("scadenze")
  .upsert(mapped, { onConflict: "zoho_id" })
  .select("id")
if (upsertError) {
  throw new Error(
    `Upsert scadenze: ${upsertError.message}\n` +
      "Verifica di aver applicato supabase/migrations/20260709_scadenze_zoho_import.sql " +
      "(colonne zoho_id/proprietario_nome mancanti sul DB).",
  )
}

console.log("=== Import Scadenze ===")
console.log(`Righe processate: ${rows.length}`)
console.log(`Righe scritte (insert+update): ${upserted?.length ?? mapped.length}`)
console.log(`Proprietari risolti: ${ownersResolved}/${rows.length}`)
if (unresolvedOwners.size > 0) {
  console.log(`Proprietari NON risolti (zoho id): ${[...unresolvedOwners].join(", ")}`)
}
console.log(
  "Schema: zoho_id e proprietario_nome sono colonne aggiunte via " +
    "supabase/migrations/20260709_scadenze_zoho_import.sql (non esistevano prima).",
)
