// Delta finale Zoho -> CRM dal backup completo Zoho (Data_001.zip).
//
// Step (--step create|link|update, anche separati da virgola, oppure "all"):
//   create  clienti, lead e compiti presenti nel backup e assenti nel CRM →
//           creati con il loro ID Zoho. I lead Zoho che hanno un candidato
//           nello step "link" NON vengono creati (sarebbero duplicati).
//   link    lead CRM con zoho_id null ↔ lead Zoho assenti dal CRM, con match
//           email → telefono (ultime 10 cifre) → nome. Ambigui: solo report.
//   update  record in comune con "Ora modifica" Zoho più recente del
//           riferimento Zoho salvato nel CRM:
//             - non modificato nel CRM dopo l'ultimo allineamento → aggiorna
//               i campi mappati (mai svuotando un campo CRM) e zoho_modified_at;
//             - modificato anche nel CRM → non toccato, riga in conflitti.csv.
//           "Modificato nel CRM" = updated_at (l'unica colonna di ultima
//           modifica scritta dall'app su leads/clienti/compiti; nessun trigger)
//           successivo all'ultimo allineamento Zoho.
//
// Nessuna cancellazione. Default dry-run: scrive solo i CSV di report.
// Uso:
//   node --env-file=.env.local scripts/migrations/final-zoho-delta.mjs \
//     --backup ~/migrazione-finale/zoho-backup --step all [--out <cartella>] [--apply]
//
// Orari: il backup è in CET (Europe/Rome) senza offset. Si rispetta la
// convenzione già presente in ciascuna tabella, così i confronti restano
// coerenti con i dati esistenti:
//   - leads, clienti: orario "wall-clock" italiano salvato così com'è come UTC
//     (vedi lib/zoho-sync/normalizers.ts e gli import in questa cartella);
//   - compiti: orario convertito da Europe/Rome a UTC, ID Zoho con "zcrm_"
//     (formato dell'import compiti già in produzione).
import { execFile } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"
import { CLIENTI_ZOHO_FIELDS } from "./clienti-zoho-fields.mjs"

const execFileAsync = promisify(execFile)

// ─── Argomenti ──────────────────────────────────────────────────────────────

function argument(name) {
  const argv = process.argv.slice(2)
  const inline = argv.find((value) => value.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = argv.indexOf(`--${name}`)
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1]
  }
  return undefined
}

function expandHome(path) {
  return path.startsWith("~/") ? join(process.env.HOME ?? "", path.slice(2)) : path
}

const apply = process.argv.includes("--apply")
const backupArg = argument("backup")
const stepArg = argument("step")
if (!backupArg || !stepArg) {
  console.error(
    "Uso: final-zoho-delta.mjs --backup <cartella> --step create|link|update|all [--out <cartella>] [--apply]",
  )
  process.exit(1)
}
const STEP_ORDER = ["create", "link", "update"]
const steps =
  stepArg === "all"
    ? STEP_ORDER
    : stepArg.split(",").map((value) => value.trim())
for (const step of steps) {
  if (!STEP_ORDER.includes(step)) throw new Error(`Step sconosciuto: ${step}`)
}
const backupDir = resolve(expandHome(backupArg))
const zipPath = join(backupDir, "Data_001.zip")
const outDir = resolve(
  expandHome(argument("out") ?? join(dirname(backupDir), "final-zoho-delta-report")),
)

// ─── Normalizzatori (stessa semantica di lib/zoho-sync/normalizers.ts) ──────

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
  if (["true", "vero", "yes", "si", "sì", "1"].includes(normalized)) return true
  if (["false", "falso", "no", "0"].includes(normalized)) return false
  return null
}

// Il backup usa il punto come separatore decimale ("66000.0"): non va tolto.
function numberValue(value) {
  const normalized = String(value ?? "").trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const NAIVE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/

// Convenzione leads/clienti: wall-clock italiano salvato come UTC.
function wallClockTimestamp(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const withOffsetColon = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const isoLike = withOffsetColon.includes("T")
    ? withOffsetColon
    : withOffsetColon.replace(" ", "T")
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike)
  const parsed = new Date(hasTimezone ? isoLike : `${isoLike}Z`)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

const romeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function romeOffsetMs(instant) {
  const parts = Object.fromEntries(
    romeFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - instant
}

// Convenzione compiti: orario CET/CEST (Europe/Rome) convertito in UTC.
function romeTimestamp(value) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return null
  const match = normalized.match(NAIVE_TIMESTAMP)
  if (!match) return wallClockTimestamp(normalized)
  const [, yyyy, mm, dd, hh = "00", mi = "00", ss = "00"] = match
  const wallClock = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)
  let instant = wallClock - romeOffsetMs(wallClock)
  instant = wallClock - romeOffsetMs(instant)
  return new Date(instant).toISOString()
}

function millis(value) {
  if (!value) return null
  const parsed = new Date(value).valueOf()
  return Number.isNaN(parsed) ? null : parsed
}

// ─── Mapping campi ──────────────────────────────────────────────────────────
// Clienti: CLIENTI_ZOHO_FIELDS (scripts/migrations/clienti-zoho-fields.mjs).
// Lead: stessi campi di sourceToLead in import-zoho-leads.mjs.
// Compiti: COMPITI_ZOHO_MAPPINGS in lib/zoho-sync/compiti-mapping.ts.
// Intestazioni assenti dal backup (es. "Lead Name", i nomi dei proprietari)
// vengono ignorate: un campo senza dato nel backup non è mai toccato.

const LEAD_FIELDS = [
  { zoho: "Lead Proprietario.id", column: "zoho_owner_id", type: "zoho_id" },
  { zoho: "Creato da.id", column: "zoho_creato_da_id", type: "zoho_id" },
  { zoho: "Account convertito.id", column: "zoho_account_convertito_id", type: "zoho_id" },
  { zoho: "Contatto convertito.id", column: "zoho_contatto_convertito_id", type: "zoho_id" },
  { zoho: "Installatore - Incaricato sopralluogo.id", column: "zoho_installatore_sopralluogo_id", type: "zoho_id" },
  { zoho: "Installatore - Incaricato sopralluogo", column: "zoho_installatore_sopralluogo_nome", type: "text" },
  { zoho: "Connesso a.id", column: "zoho_connesso_a_id", type: "zoho_id" },
  { zoho: "Nome", column: "nome", type: "text" },
  { zoho: "Cognome", column: "cognome", type: "text" },
  { zoho: ["Lead Name", "Nome e cognome"], column: "nome_lead", type: "text" },
  { zoho: "E-mail", column: "email", type: "text" },
  { zoho: "Telefono", column: "telefono", type: "text" },
  { zoho: "Mobile/Fisso", column: "mobile_fisso", type: "text" },
  { zoho: "Social Lead ID", column: "social_lead_id", type: "text" },
  { zoho: "Residente in Sicilia", column: "residente_in_sicilia", type: "boolean" },
  { zoho: "Città", column: "citta", type: "text" },
  { zoho: "Provincia", column: "provincia", type: "text" },
  { zoho: "Codice postale", column: "codice_postale", type: "text" },
  { zoho: "Paese", column: "paese", type: "text" },
  { zoho: "Stato Lead", column: "stato_lead", type: "text" },
  { zoho: "Stato", column: "stato_email", type: "text" },
  { zoho: "Valutazione", column: "rating", type: "text" },
  { zoho: "Stato arricchito", column: "stato_arricchito", type: "text" },
  { zoho: "Punteggio visitatore", column: "valutazione", type: "numeric" },
  { zoho: "Origine Lead", column: "origine_lead", type: "origine_lead" },
  { zoho: "campaign name", column: "campaign_name", type: "text" },
  { zoho: "Descrizione", column: "descrizione", type: "text" },
  { zoho: "Saluti", column: "saluti", type: "text" },
  { zoho: "Data sopralluogo", column: "data_sopralluogo", type: "timestamp" },
  { zoho: "Tempo di conversione Lead", column: "tempo_conversione_lead", type: "text" },
  { zoho: "Contatto convertito", column: "contatto_convertito", type: "text" },
  { zoho: "Modalità iscrizione annullata", column: "modalita_iscrizione_annullata", type: "text" },
  { zoho: "Ora  iscrizione annullata", column: "ora_iscrizione_annullata", type: "timestamp" },
  { zoho: "Connected To.module", column: "connesso_a", type: "text" },
  { zoho: "Creato da", column: "creato_da", type: "text" },
  { zoho: "Data Click", column: "data_click", type: "timestamp" },
  { zoho: "Data/Ora", column: "data_ora", type: "timestamp" },
  { zoho: "Ora ultima attività", column: "ora_ultima_attivita", type: "timestamp" },
  { zoho: "è convertito", column: "convertito", type: "boolean" },
  { zoho: "Locked", column: "bloccato", type: "boolean" },
  { zoho: "Orario del registro delle modifiche", column: "zoho_modified_at", type: "timestamp" },
]

const CLIENTE_FIELDS = CLIENTI_ZOHO_FIELDS.filter((field) => field.column !== "zoho_record_id").map(
  (field) => ({
    zoho: field.column === "nome_clienti" ? [field.zoho, "Nome e cognome"] : field.zoho,
    column: field.column,
    type: field.column.endsWith("_zoho_id") ? "zoho_id" : field.type,
  }),
)

const COMPITO_FIELDS = [
  { zoho: "Proprietario del compito.id", column: "proprietario_zoho_id", type: "zoho_ref" },
  { zoho: "Proprietario del compito", column: "proprietario_nome", type: "text" },
  { zoho: "Oggetto", column: "oggetto", type: "text" },
  { zoho: "Data di scadenza", column: "scadenza", type: "timestamp" },
  { zoho: "Nome contatto.id", column: "nome_contatto_zoho_id", type: "zoho_ref" },
  { zoho: "Nome contatto", column: "nome_contatto", type: "text" },
  { zoho: "Correlato a.id", column: "correlato_zoho_id", type: "zoho_ref" },
  { zoho: "Correlato a", column: "correlato_nome", type: "text" },
  { zoho: "Stato", column: "stato", type: "text" },
  { zoho: "Priorità", column: "priorita", type: "text" },
  { zoho: "Ripeti", column: "ripeti", type: "text" },
  { zoho: "Promemoria", column: "promemoria", type: "timestamp" },
  { zoho: "Creato da.id", column: "creato_da_zoho_id", type: "zoho_ref" },
  { zoho: "Creato da", column: "creato_da_nome", type: "text" },
  { zoho: "Modificato da.id", column: "modificato_da_zoho_id", type: "zoho_ref" },
  { zoho: "Modificato da", column: "modificato_da_nome", type: "text" },
  { zoho: "Ora creazione", column: "ora_creazione", type: "timestamp" },
  { zoho: "Ora modifica", column: "ora_modifica", type: "timestamp" },
  { zoho: "Descrizione", column: "descrizione", type: "text" },
  { zoho: "Orario di chiusura", column: "orario_chiusura", type: "timestamp" },
  { zoho: "Tag", column: "tag", type: "text" },
  { zoho: "Locked", column: "locked", type: "boolean" },
  { zoho: "Ora ultima attività", column: "ora_ultima_attivita", type: "timestamp" },
  { zoho: "Orario del registro delle modifiche", column: "zoho_modified_at", type: "timestamp" },
]

// Come origineLeadValue in import-zoho-leads.mjs: Zoho a volte mette una data.
function origineLeadValue(row) {
  const value = nullable(row["Origine Lead"])
  if (!value) return null
  if (Number.isFinite(Date.parse(value))) {
    return nullable(row["campaign name"]) ? "Pubblicità" : null
  }
  return value
}

const MODULES = {
  clienti: {
    label: "cliente",
    table: "clienti",
    csv: "Data/Clienti_001.csv",
    key: "zoho_record_id",
    fields: CLIENTE_FIELDS,
    timestamp: wallClockTimestamp,
    storeZohoId: (id) => id,
    nameOf: (row) => row.nome_clienti ?? joinName(row.nome, row.cognome),
  },
  leads: {
    label: "lead",
    table: "leads",
    csv: "Data/Leads_001.csv",
    key: "zoho_id",
    fields: LEAD_FIELDS,
    timestamp: wallClockTimestamp,
    storeZohoId: (id) => id,
    nameOf: (row) => row.nome_lead ?? joinName(row.nome, row.cognome),
  },
  compiti: {
    label: "compito",
    table: "compiti",
    csv: "Data/Tasks_001.csv",
    key: "zoho_record_id",
    fields: COMPITO_FIELDS,
    timestamp: romeTimestamp,
    storeZohoId: (id) => `zcrm_${id}`,
    nameOf: (row) => row.oggetto,
  },
}

function joinName(nome, cognome) {
  return [nome, cognome].filter(Boolean).join(" ").trim() || null
}

function fieldHeaders(field) {
  return Array.isArray(field.zoho) ? field.zoho : [field.zoho]
}

// Valore Zoho tipizzato; undefined = intestazione assente dal backup.
function zohoFieldValue(module, field, row) {
  const header = fieldHeaders(field).find((name) => name in row)
  if (header === undefined) return undefined
  const raw = row[header]
  switch (field.type) {
    case "zoho_id":
      return normalizeZohoId(raw) || null
    case "zoho_ref":
      return nullable(raw)
    case "boolean":
      return booleanValue(raw)
    case "numeric":
      return numberValue(raw)
    case "timestamp":
      return module.timestamp(raw)
    case "origine_lead":
      return origineLeadValue(row)
    default:
      return nullable(raw)
  }
}

function mapZohoRow(module, row) {
  const mapped = {}
  for (const field of module.fields) {
    const value = zohoFieldValue(module, field, row)
    if (value !== undefined) mapped[field.column] = value
  }
  return mapped
}

function comparable(value) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "boolean" || typeof value === "number") return value
  return String(value).trim()
}

function sameValue(field, crmValue, zohoValue) {
  if (field.type === "timestamp") return millis(crmValue) === millis(zohoValue)
  if (field.type === "numeric" && crmValue !== null && crmValue !== undefined) {
    return Number(crmValue) === Number(zohoValue)
  }
  if (field.type === "zoho_id" || field.type === "zoho_ref") {
    return normalizeZohoId(crmValue) === normalizeZohoId(zohoValue)
  }
  return comparable(crmValue) === comparable(zohoValue)
}

// ─── I/O ────────────────────────────────────────────────────────────────────

async function readBackupCsv(entry) {
  const { stdout } = await execFileAsync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024,
  })
  return parse(stdout, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id")
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeReport(name, rows) {
  const header = ["azione", "modulo", "id_crm", "zoho_id", "nome", "campi"]
  const lines = [header.join(",")]
  for (const row of rows) lines.push(header.map((key) => csvCell(row[key])).join(","))
  const path = join(outDir, name)
  writeFileSync(path, `﻿${lines.join("\n")}\n`, "utf8")
  return path
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "∅"
  const text = String(value).replace(/\s+/g, " ")
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

function describeChanges(changes) {
  return changes
    .map(({ column, from, to }) => `${column}: ${formatValue(from)} → ${formatValue(to)}`)
    .join(" | ")
}

function describeValues(record) {
  return Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([column, value]) => `${column}=${formatValue(value)}`)
    .join(" | ")
}

async function pool(items, worker, label) {
  const concurrency = 8
  let index = 0
  let done = 0
  async function run() {
    while (index < items.length) {
      const item = items[index]
      index += 1
      await worker(item)
      done += 1
      if (done % 100 === 0 || done === items.length) {
        process.stdout.write(`${label}: ${done}/${items.length}\r`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
  if (items.length > 0) process.stdout.write("\n")
}

// ─── Caricamento dati ───────────────────────────────────────────────────────

const backup = {}
for (const [name, module] of Object.entries(MODULES)) {
  const rows = await readBackupCsv(module.csv)
  const byZohoId = new Map()
  for (const row of rows) {
    const zohoId = normalizeZohoId(row["ID record"])
    if (!zohoId) continue
    if (byZohoId.has(zohoId)) throw new Error(`${name}: ID Zoho duplicato nel backup ${zohoId}`)
    byZohoId.set(zohoId, row)
  }
  backup[name] = byZohoId
}

const CRM_SELECT = {
  clienti: ["id", "zoho_record_id", "updated_at", "zoho_synced_at", "clienti_proprietario_id", "installatore_id", ...CLIENTE_FIELDS.map((f) => f.column)],
  leads: ["id", "zoho_id", "updated_at", "zoho_synced_at", "lead_proprietario_id", ...LEAD_FIELDS.map((f) => f.column)],
  compiti: ["id", "zoho_record_id", "created_at", "updated_at", "zoho_synced_at", "proprietario_id", "correlato_id", "correlato_tipo", ...COMPITO_FIELDS.map((f) => f.column)],
}

async function loadCrm() {
  const crm = {}
  for (const [name, module] of Object.entries(MODULES)) {
    const rows = await fetchAll(module.table, [...new Set(CRM_SELECT[name])].join(","))
    const byZohoId = new Map()
    for (const row of rows) {
      const zohoId = normalizeZohoId(row[module.key])
      if (zohoId) byZohoId.set(zohoId, row)
    }
    crm[name] = { rows, byZohoId }
  }
  return crm
}

const [utenti, installatori] = await Promise.all([
  fetchAll("utenti", "id,zoho_id"),
  fetchAll("installatori", "id,zoho_id"),
])
const utenteByZohoId = new Map(
  utenti.filter((u) => u.zoho_id).map((u) => [normalizeZohoId(u.zoho_id), u.id]),
)
const installatoreByZohoId = new Map(
  installatori.filter((i) => i.zoho_id).map((i) => [normalizeZohoId(i.zoho_id), i.id]),
)

let crm = await loadCrm()

// Riferimenti interni (uuid) risolti dagli ID Zoho, come negli import esistenti.
function resolvedRefs(name, row) {
  if (name === "clienti") {
    return {
      clienti_proprietario_id: utenteByZohoId.get(normalizeZohoId(row["Clienti Proprietario.id"])) ?? null,
      installatore_id: installatoreByZohoId.get(normalizeZohoId(row["Installatore.id"])) ?? null,
    }
  }
  if (name === "leads") {
    return {
      lead_proprietario_id: utenteByZohoId.get(normalizeZohoId(row["Lead Proprietario.id"])) ?? null,
    }
  }
  return {
    proprietario_id: utenteByZohoId.get(normalizeZohoId(row["Proprietario del compito.id"])) ?? null,
  }
}

// ─── Step link: matching lead ───────────────────────────────────────────────

function emailKey(value) {
  const normalized = String(value ?? "").trim().toLowerCase()
  return normalized.includes("@") ? normalized : null
}

function phoneKey(value) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits.length >= 9 ? digits.slice(-10) : null
}

function nameKey(value) {
  const tokens = String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  // Ordinati: "Rossi Mario" e "Mario Rossi" coincidono.
  return tokens.length >= 2 ? tokens.sort().join(" ") : null
}

function zohoLeadKeys(row) {
  return {
    email: [emailKey(row["E-mail"]), emailKey(row["E-mail secondaria"])].filter(Boolean),
    telefono: [phoneKey(row.Telefono), phoneKey(row.Cellulare), phoneKey(row["Mobile/Fisso"])].filter(Boolean),
    nome: [nameKey(row["Nome e cognome"] || joinName(row.Nome, row.Cognome))].filter(Boolean),
  }
}

function crmLeadKeys(lead) {
  return {
    email: [emailKey(lead.email)].filter(Boolean),
    telefono: [phoneKey(lead.telefono), phoneKey(lead.mobile_fisso)].filter(Boolean),
    nome: [nameKey(lead.nome_lead || joinName(lead.nome, lead.cognome))].filter(Boolean),
  }
}

function computeLinks() {
  const unlinked = crm.leads.rows.filter((lead) => !lead.zoho_id)
  const index = { email: new Map(), telefono: new Map(), nome: new Map() }
  for (const lead of unlinked) {
    const keys = crmLeadKeys(lead)
    for (const level of Object.keys(index)) {
      for (const key of new Set(keys[level])) {
        if (!index[level].has(key)) index[level].set(key, new Set())
        index[level].get(key).add(lead)
      }
    }
  }

  const proposals = []
  for (const [zohoId, row] of backup.leads) {
    if (crm.leads.byZohoId.has(zohoId)) continue
    const keys = zohoLeadKeys(row)
    for (const level of ["email", "telefono", "nome"]) {
      const candidates = new Set()
      for (const key of keys[level]) {
        for (const lead of index[level].get(key) ?? []) candidates.add(lead)
      }
      if (candidates.size === 0) continue
      proposals.push({ zohoId, row, level, candidates: [...candidates] })
      break
    }
  }

  // 1:1 — un lead CRM proposto per più lead Zoho rende ambigui tutti.
  const claims = new Map()
  for (const proposal of proposals) {
    if (proposal.candidates.length !== 1) continue
    const leadId = proposal.candidates[0].id
    claims.set(leadId, (claims.get(leadId) ?? 0) + 1)
  }
  const links = []
  const ambiguous = []
  for (const proposal of proposals) {
    if (proposal.candidates.length === 1 && claims.get(proposal.candidates[0].id) === 1) {
      links.push({ ...proposal, lead: proposal.candidates[0] })
    } else {
      ambiguous.push({
        ...proposal,
        reason:
          proposal.candidates.length > 1
            ? `${proposal.candidates.length} lead CRM per ${proposal.level}`
            : `lead CRM conteso da più lead Zoho (${proposal.level})`,
      })
    }
  }
  return { links, ambiguous, withCandidates: new Set(proposals.map((p) => p.zohoId)) }
}

// ─── Step create ────────────────────────────────────────────────────────────

function buildNewRecord(name, zohoId, row) {
  const module = MODULES[name]
  const record = { [module.key]: module.storeZohoId(zohoId), ...mapZohoRow(module, row), ...resolvedRefs(name, row) }
  for (const [column, value] of Object.entries(record)) {
    if (value === null) delete record[column]
  }
  // Stessa convenzione degli import: created_at/updated_at dagli orari Zoho.
  const createdAt = module.timestamp(row["Ora creazione"])
  const modifiedAt = record.zoho_modified_at ?? module.timestamp(row["Ora modifica"])
  if (createdAt) record.created_at = createdAt
  if (modifiedAt) record.updated_at = modifiedAt
  if (name === "clienti") record.ora_modifica ??= modifiedAt
  return record
}

function resolveCorrelato(record, leadIds, clienteIds) {
  const zohoId = normalizeZohoId(record.correlato_zoho_id)
  if (!zohoId) return "nessuno"
  const lead = leadIds.get(zohoId)
  const cliente = clienteIds.get(zohoId)
  if (lead && cliente) return "ambiguo"
  if (!lead && !cliente) return "non risolto"
  record.correlato_id = lead ?? cliente
  record.correlato_tipo = lead ? "lead" : "cliente"
  return record.correlato_tipo
}

function tagKey(value) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("it")
}

async function assignLeadTags(inserted) {
  const wanted = inserted
    .map(({ id, row }) => ({
      id,
      tags: String(row.Tag ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    }))
    .filter((item) => item.tags.length > 0)
  if (wanted.length === 0) return 0
  const existing = await fetchAll("tag", "id,nome,modulo")
  const tagIds = new Map(existing.filter((t) => t.modulo === "lead").map((t) => [tagKey(t.nome), t.id]))
  const missing = new Map()
  for (const { tags } of wanted) {
    for (const tag of tags) if (!tagIds.has(tagKey(tag))) missing.set(tagKey(tag), tag)
  }
  if (missing.size > 0) {
    const { data, error } = await supabase
      .from("tag")
      .insert([...missing.values()].map((nome) => ({ nome, colore: "#64748b", modulo: "lead" })))
      .select("id,nome")
    if (error) throw new Error(`Creazione tag lead: ${error.message}`)
    for (const tag of data ?? []) tagIds.set(tagKey(tag.nome), tag.id)
  }
  const assignments = wanted.flatMap(({ id, tags }) =>
    tags.map((tag) => ({ lead_id: id, tag_id: tagIds.get(tagKey(tag)) })).filter((a) => a.tag_id),
  )
  const { error } = await supabase.from("lead_tags").upsert(assignments, { onConflict: "lead_id,tag_id" })
  if (error) throw new Error(`Assegnazione tag lead: ${error.message}`)
  return assignments.length
}

async function stepCreate() {
  const { withCandidates } = computeLinks()
  const report = []
  const summary = {}
  const plan = {}
  for (const name of ["clienti", "leads", "compiti"]) {
    const missing = [...backup[name]].filter(([zohoId]) => !crm[name].byZohoId.has(zohoId))
    const skipped = name === "leads" ? missing.filter(([zohoId]) => withCandidates.has(zohoId)) : []
    const toCreate = missing.filter(([zohoId]) => !(name === "leads" && withCandidates.has(zohoId)))
    plan[name] = toCreate.map(([zohoId, row]) => ({ zohoId, row, record: buildNewRecord(name, zohoId, row) }))
    summary[name] = { assentiNelCrm: missing.length, daCreare: toCreate.length }
    if (name === "leads") summary[name].rinviatiAlLink = skipped.length
  }

  // Correlati dei compiti: verso lead/clienti già nel CRM o creati qui sopra.
  const leadIds = new Map([...crm.leads.byZohoId].map(([z, r]) => [z, r.id]))
  const clienteIds = new Map([...crm.clienti.byZohoId].map(([z, r]) => [z, r.id]))
  const correlati = {}
  const pendingCorrelati = []
  for (const item of plan.compiti) {
    let outcome = resolveCorrelato(item.record, leadIds, clienteIds)
    const zohoRef = normalizeZohoId(item.record.correlato_zoho_id)
    if (outcome === "non risolto" && (plan.leads.some((l) => l.zohoId === zohoRef) || plan.clienti.some((c) => c.zohoId === zohoRef))) {
      outcome = "record creato in questo step"
      pendingCorrelati.push(item)
    }
    correlati[outcome] = (correlati[outcome] ?? 0) + 1
  }
  summary.compiti.correlati = correlati

  for (const name of ["clienti", "leads", "compiti"]) {
    for (const { zohoId, record } of plan[name]) {
      report.push({
        azione: apply ? "creato" : "da creare",
        modulo: MODULES[name].label,
        id_crm: "",
        zoho_id: zohoId,
        nome: MODULES[name].nameOf(record),
        campi: describeValues(record),
      })
    }
  }
  for (const [zohoId] of [...backup.leads].filter(([z]) => !crm.leads.byZohoId.has(z) && withCandidates.has(z))) {
    report.push({ azione: "rinviato al link", modulo: "lead", id_crm: "", zoho_id: zohoId, nome: backup.leads.get(zohoId)["Nome e cognome"], campi: "" })
  }

  if (apply) {
    const insertedLeads = []
    for (const name of ["clienti", "leads", "compiti"]) {
      if (name === "compiti") {
        for (const item of pendingCorrelati) {
          const z = normalizeZohoId(item.record.correlato_zoho_id)
          resolveCorrelato(item.record, leadIds, clienteIds)
          if (!item.record.correlato_id) summary.compiti.correlati[`non risolto (${z})`] = 1
        }
      }
      for (let i = 0; i < plan[name].length; i += 100) {
        const batch = plan[name].slice(i, i + 100)
        const { data, error } = await supabase
          .from(MODULES[name].table)
          .insert(batch.map((item) => item.record))
          .select(`id,${MODULES[name].key}`)
        if (error) throw new Error(`Inserimento ${name}: ${error.message}`)
        for (const inserted of data ?? []) {
          const zohoId = normalizeZohoId(inserted[MODULES[name].key])
          if (name === "leads") {
            leadIds.set(zohoId, inserted.id)
            insertedLeads.push({ id: inserted.id, row: backup.leads.get(zohoId) })
          }
          if (name === "clienti") clienteIds.set(zohoId, inserted.id)
        }
      }
    }
    summary.leads.tagAssegnati = await assignLeadTags(insertedLeads)
    crm = await loadCrm()
  }

  return { report, summary }
}

// ─── Step link ──────────────────────────────────────────────────────────────

async function stepLink() {
  const { links, ambiguous } = computeLinks()
  const report = []
  for (const link of links) {
    report.push({
      azione: apply ? "collegato" : "da collegare",
      modulo: "lead",
      id_crm: link.lead.id,
      zoho_id: link.zohoId,
      nome: link.lead.nome_lead ?? joinName(link.lead.nome, link.lead.cognome),
      campi: `zoho_id: ∅ → ${link.zohoId} (match ${link.level}; Zoho: ${link.row["Nome e cognome"]})`,
    })
  }
  for (const item of ambiguous) {
    report.push({
      azione: "ambiguo",
      modulo: "lead",
      id_crm: item.candidates.map((lead) => lead.id).join(" "),
      zoho_id: item.zohoId,
      nome: item.row["Nome e cognome"],
      campi: `${item.reason}: ${item.candidates.map((lead) => lead.nome_lead ?? joinName(lead.nome, lead.cognome)).join(" / ")}`,
    })
  }
  const byLevel = links.reduce((acc, link) => ((acc[link.level] = (acc[link.level] ?? 0) + 1), acc), {})

  const summary = {
    leadCrmSenzaZohoId: crm.leads.rows.filter((lead) => !lead.zoho_id).length,
    leadZohoAssentiNelCrm: [...backup.leads.keys()].filter((z) => !crm.leads.byZohoId.has(z)).length,
    daCollegare: links.length,
    perCriterio: byLevel,
    ambigui: ambiguous.length,
  }

  let written = 0
  if (apply) {
    await pool(
      links,
      async (link) => {
        // Guardia: collega solo se il lead è ancora senza zoho_id.
        const { data, error } = await supabase
          .from("leads")
          .update({ zoho_id: link.zohoId })
          .eq("id", link.lead.id)
          .is("zoho_id", null)
          .select("id")
        if (error) throw new Error(`Link lead ${link.lead.id}: ${error.message}`)
        written += data?.length ?? 0
      },
      "link",
    )
    crm = await loadCrm()
  }

  if (apply) summary.collegati = written
  return { report, summary }
}

// ─── Step update ────────────────────────────────────────────────────────────

// Tolleranza per gli arrotondamenti tra timestamp scritti nella stessa insert.
const CRM_EDIT_TOLERANCE_MS = 1000

function lastAlignment(name, record) {
  const marks = [millis(record.zoho_modified_at), millis(record.zoho_synced_at)]
  // Compiti: zoho_modified_at mai valorizzato dall'import; l'allineamento è
  // l'import stesso (created_at dei record importati).
  if (name === "compiti") marks.push(millis(record.created_at))
  const valid = marks.filter((value) => value !== null)
  return valid.length > 0 ? Math.max(...valid) : null
}

function updateChanges(name, record, row) {
  const module = MODULES[name]
  const changes = []
  const payload = {}
  for (const field of module.fields) {
    const value = zohoFieldValue(module, field, row)
    // Mai svuotare un campo CRM con un valore Zoho vuoto (o assente dal backup).
    if (value === undefined || value === null) continue
    if (field.column === "zoho_modified_at") continue
    if (sameValue(field, record[field.column], value)) continue
    changes.push({ column: field.column, from: record[field.column], to: value })
    payload[field.column] = value
  }
  for (const [column, value] of Object.entries(resolvedRefs(name, row))) {
    if (value === null || record[column] === value) continue
    changes.push({ column, from: record[column], to: value })
    payload[column] = value
  }
  return { changes, payload }
}

async function stepUpdate() {
  const report = []
  const conflicts = []
  const summary = {}
  const writes = []

  for (const name of ["clienti", "leads", "compiti"]) {
    const module = MODULES[name]
    const counts = { inComune: 0, zohoPiuRecente: 0, aggiornabili: 0, conflitti: 0, senzaDifferenze: 0, senzaRiferimentoZoho: 0 }
    const fieldStats = {}
    for (const [zohoId, row] of backup[name]) {
      const record = crm[name].byZohoId.get(zohoId)
      if (!record) continue
      counts.inComune += 1
      const zohoModified = millis(module.timestamp(row["Ora modifica"]))
      const crmReference = millis(record.zoho_modified_at ?? (name === "compiti" ? record.ora_modifica : null))
      if (crmReference === null) {
        counts.senzaRiferimentoZoho += 1
        continue
      }
      if (zohoModified === null || zohoModified <= crmReference) continue
      counts.zohoPiuRecente += 1

      const { changes, payload } = updateChanges(name, record, row)
      const newZohoModified = [
        module.timestamp(row["Orario del registro delle modifiche"]),
        module.timestamp(row["Ora modifica"]),
      ].filter(Boolean).sort().at(-1)
      const aligned = lastAlignment(name, record)
      const editedInCrm = millis(record.updated_at) > aligned + CRM_EDIT_TOLERANCE_MS
      const base = {
        modulo: module.label,
        id_crm: record.id,
        zoho_id: zohoId,
        nome: module.nameOf(record) ?? module.nameOf(mapZohoRow(module, row)),
      }

      if (editedInCrm) {
        counts.conflitti += 1
        conflicts.push({
          ...base,
          azione: "conflitto",
          campi: `CRM updated_at ${record.updated_at} > allineamento ${new Date(aligned).toISOString()}; Zoho Ora modifica ${row["Ora modifica"]}` +
            (changes.length > 0 ? ` || ${describeChanges(changes)}` : " || nessun campo diverso"),
        })
        continue
      }
      if (changes.length === 0) counts.senzaDifferenze += 1
      else counts.aggiornabili += 1
      for (const change of changes) fieldStats[change.column] = (fieldStats[change.column] ?? 0) + 1
      report.push({
        ...base,
        azione: changes.length > 0 ? (apply ? "aggiornato" : "da aggiornare") : "solo zoho_modified_at",
        campi: describeChanges([
          ...changes,
          { column: "zoho_modified_at", from: record.zoho_modified_at, to: newZohoModified },
        ]),
      })
      writes.push({ name, record, payload: { ...payload, zoho_modified_at: newZohoModified } })
    }
    counts.campiPiuModificati = Object.fromEntries(
      Object.entries(fieldStats).sort((a, b) => b[1] - a[1]).slice(0, 10),
    )
    summary[name] = counts
  }

  if (apply) {
    let written = 0
    let skippedConcurrent = 0
    await pool(
      writes,
      async ({ name, record, payload }) => {
        // Guardia: se nel frattempo il record è stato modificato nel CRM,
        // updated_at è cambiato e l'update non tocca nulla.
        const { data, error } = await supabase
          .from(MODULES[name].table)
          .update(payload)
          .eq("id", record.id)
          .eq("updated_at", record.updated_at)
          .select("id")
        if (error) throw new Error(`Update ${name} ${record.id}: ${error.message}`)
        if (data?.length) written += 1
        else skippedConcurrent += 1
      },
      "update",
    )
    summary.scritti = written
    summary.saltatiPerModificaConcorrente = skippedConcurrent
  }

  return { report, conflicts, summary }
}

// ─── Main ───────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true })
console.log(`Modalità: ${apply ? "APPLY (scrittura su Supabase)" : "dry-run"}`)
console.log(`Backup: ${zipPath}`)
console.log(`Report: ${outDir}`)
console.log(
  `Backup letto: ${backup.clienti.size} clienti, ${backup.leads.size} lead, ${backup.compiti.size} compiti`,
)

for (const step of STEP_ORDER.filter((value) => steps.includes(value))) {
  console.log(`\n── Step ${step} ──`)
  if (step === "create") {
    const { report, summary } = await stepCreate()
    console.log(JSON.stringify(summary, null, 2))
    console.log(`→ ${writeReport("create.csv", report)}`)
  } else if (step === "link") {
    const { report, summary } = await stepLink()
    console.log(JSON.stringify(summary, null, 2))
    console.log(`→ ${writeReport("link.csv", report)}`)
  } else {
    const { report, conflicts, summary } = await stepUpdate()
    console.log(JSON.stringify(summary, null, 2))
    console.log(`→ ${writeReport("update.csv", report)}`)
    console.log(`→ ${writeReport("conflitti.csv", conflicts)}`)
  }
}

if (!apply) console.log("\nDry-run completato: nessun dato scritto. Aggiungi --apply per scrivere.")
