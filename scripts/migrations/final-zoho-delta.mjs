// Delta finale Zoho -> CRM dal backup completo Zoho (Data_001.zip).
//
// Zoho è il sistema operativo, il CRM è in test: dove i due divergono vince Zoho.
//
// Step (--step create|link|update|fix-decimali, anche separati da virgola,
// oppure "all"):
//   create        clienti, lead e compiti presenti nel backup e assenti nel CRM
//                 → creati con il loro ID Zoho. Non vengono creati: i lead Zoho
//                 con un candidato di link (inclusi gli ambigui, solo report) e i
//                 compiti non collegati a un lead/cliente del CRM ("no_correlato").
//   link          lead CRM con zoho_id null ↔ lead Zoho assenti dal CRM, con match
//                 email → telefono (ultime 10 cifre) → nome. Ambigui (di solito
//                 lead doppi in Zoho): solo report.
//   update        record in comune con "Ora modifica" Zoho più recente di quella
//                 salvata nel CRM (o senza riferimento, es. lead appena collegati):
//                 Zoho vince anche sui record modificati nel CRM. Si scrivono solo
//                 i campi con un valore in Zoho (un campo vuoto non tocca il CRM),
//                 mai i proprietari, più zoho_modified_at.
//   fix-decimali  tutti i clienti in comune: i campi numerici presi dal backup
//                 (il vecchio import aveva perso il separatore decimale).
//
// Report: create.csv, link.csv, update-campi.csv (una riga per campo che
// cambia, da update e fix-decimali), revisione.csv, revisione-clienti.csv,
// revisione-lead.csv, valori-non-mappati.csv + riepilogo per step e per campo.
// Lo script scrive solo i campi del mapping Zoho → CRM: l'elenco viene
// stampato all'avvio e ogni scrittura è verificata contro di esso.
//
// Nessuna cancellazione. Default dry-run: scrive solo i CSV di report.
// Uso:
//   node --env-file=.env.local scripts/migrations/final-zoho-delta.mjs \
//     --backup ~/migrazione-finale/zoho-backup --step all [--out <cartella>] [--apply]
//   solo alcuni campi: --step update --campi iva,messaggio_fattura (non avanza
//   zoho_modified_at); con --solo-multipli, solo i record con più valori
//   ("A;B") in Zoho in quei campi; --moduli clienti limita ai moduli indicati;
//   --zoho-vince scrive il valore Zoho quando è diverso, senza merge a tre vie
//
// Orari: il backup è in CET (Europe/Rome) senza offset. Si rispetta la
// convenzione già presente in ciascuna tabella, così i confronti restano
// coerenti con i dati esistenti:
//   - leads, clienti: orario "wall-clock" italiano salvato così com'è come UTC
//     (vedi lib/zoho-sync/normalizers.ts e gli import in questa cartella);
//   - compiti: orario convertito da Europe/Rome a UTC, ID Zoho con "zcrm_"
//     (formato dell'import compiti già in produzione).
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
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
    "Uso: final-zoho-delta.mjs --backup <cartella> --step create|link|update|fix-decimali|all [--out <cartella>] [--apply]",
  )
  process.exit(1)
}
const STEP_ORDER = ["create", "link", "update", "fix-decimali"]
// --campi col1,col2: l'update considera solo queste colonne (per ogni modulo
// che le ha) e NON avanza zoho_modified_at, perché gli altri campi del record
// non sono stati allineati. Solo con --step update.
const campiFilter = argument("campi")
  ? new Set(argument("campi").split(",").map((value) => value.trim()).filter(Boolean))
  : null
// --solo-multipli (con --campi): solo i record che in Zoho hanno più valori
// ("A;B") in almeno uno dei campi scelti.
const soloMultipli = process.argv.includes("--solo-multipli")
// --zoho-vince (con --campi): nei campi scelti vale il valore Zoho quando è
// diverso, senza merge a tre vie. Per riallineamenti mirati in cui il CRM non
// ha una versione base utilizzabile (es. un valore scartato da un update
// precedente mentre zoho_modified_at avanzava). Ogni scrittura resta in
// update-campi.csv con il valore CRM precedente.
const zohoVince = process.argv.includes("--zoho-vince")
// --moduli clienti,leads (con --campi): l'update considera solo questi moduli.
// Serve quando una colonna ha lo stesso nome in più moduli (es. stato su
// clienti e compiti).
const moduliFilter = argument("moduli")
  ? new Set(argument("moduli").split(",").map((value) => value.trim()).filter(Boolean))
  : null
const steps =
  stepArg === "all"
    ? STEP_ORDER
    : stepArg.split(",").map((value) => value.trim())
for (const step of steps) {
  if (!STEP_ORDER.includes(step)) throw new Error(`Step sconosciuto: ${step}`)
}
if (campiFilter && (steps.length !== 1 || steps[0] !== "update")) {
  throw new Error("--campi si usa solo con --step update")
}
if (soloMultipli && !campiFilter) throw new Error("--solo-multipli si usa solo insieme a --campi")
if (moduliFilter && !campiFilter) throw new Error("--moduli si usa solo insieme a --campi")
if (zohoVince && !campiFilter) throw new Error("--zoho-vince si usa solo insieme a --campi")
for (const modulo of moduliFilter ?? []) {
  if (!["clienti", "leads", "compiti"].includes(modulo)) throw new Error(`Modulo sconosciuto: ${modulo}`)
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
  { zoho: "Stato", column: "stato", type: "stato_compito" },
  { zoho: "Priorità", column: "priorita", type: "priorita_compito" },
  { zoho: "Ripeti", column: "ripeti", type: "ripeti" },
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

// Stato/priorità compiti come in scripts/import-zoho-compiti.mjs (set canonico
// usato da UI e kanban).
const STATO_COMPITO_CANONICO = new Map([
  ["non iniziato", "Non iniziato"],
  ["da fare", "Non iniziato"],
  ["in corso", "In corso"],
  ["rinviato", "Rinviato"],
  ["differito", "Rinviato"],
  ["posticipato", "Rinviato"],
  ["in attesa di input", "In attesa di input"],
  ["in attesa", "In attesa di input"],
  ["completato", "Completato"],
  ["completata", "Completato"],
])
const PRIORITA_COMPITO_CANONICA = new Map([
  ["Altissimo", "Alto"],
  ["Normale", "Medio"],
  ["Bassissimo", "Basso"],
])

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
    case "stato_compito": {
      const stato = nullable(raw)
      return stato ? STATO_COMPITO_CANONICO.get(stato.toLowerCase()) ?? stato : null
    }
    case "priorita_compito": {
      const priorita = nullable(raw)
      return priorita ? PRIORITA_COMPITO_CANONICA.get(priorita) ?? priorita : null
    }
    case "ripeti":
      // Il backup completo usa il formato interno Zoho ("daily*#1^0*#...") e
      // non l'RRULE degli export salvato nel CRM: non confrontabile, ignorato.
      return String(raw ?? "").includes("*#") ? undefined : nullable(raw)
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

// Campi a tendina: le colonne con opzioni attive in crm_column_values, la stessa
// fonte dei menu nel CRM (i valori salvati sono le etichette). Lo script non
// crea, rinomina o cancella opzioni: un valore Zoho si scrive solo se coincide
// (senza badare a maiuscole) con un'opzione esistente, altrimenti finisce in
// valori-non-mappati.csv.
// Multiselect clienti (valori separati da ";"): lib/clienti/picklist-options.ts.
const MULTISELECT_COLUMNS = {
  clienti: new Set(["stato", "stato_sollecito", "zona", "tipo_ctr", "intervento_1", "intervento_2", "mod_pagamento_ct3_0", "stato_provvigione", "tipo_di_tensione"]),
}
const PICKLISTS = {}
for (const row of await fetchAll("crm_column_values", "id,table_name,column_name,value,label,active")) {
  if (!row.active) continue
  const label = String(row.label || row.value).trim()
  PICKLISTS[row.table_name] ??= new Map()
  const columns = PICKLISTS[row.table_name]
  if (!columns.has(row.column_name)) columns.set(row.column_name, new Map())
  columns.get(row.column_name).set(label.toLowerCase(), label)
}

function isPicklist(name, column) {
  return Boolean(PICKLISTS[MODULES[name].table]?.has(column))
}

// → { value: etichetta canonica, ok: false se non corrisponde a un'opzione }
function canonicalOption(name, column, value) {
  const options = PICKLISTS[MODULES[name].table]?.get(column)
  if (!options || value === null || value === undefined) return { value, ok: true }
  const parts = MULTISELECT_COLUMNS[name]?.has(column)
    ? String(value).split(";").map((part) => part.trim()).filter(Boolean)
    : [String(value).trim()]
  const mapped = parts.map((part) => options.get(part.toLowerCase()))
  if (mapped.length === 0 || mapped.some((label) => label === undefined)) return { value, ok: false }
  return { value: mapped.join(";"), ok: true }
}

// Tipi reali delle colonne, dallo schema OpenAPI di PostgREST: il mapping
// Zoho → CRM può dichiarare "text" una colonna che nel DB è numeric (es.
// clienti.iva, dove Zoho ha anche "IVA INCLUSA"). Un valore che il DB
// rifiuterebbe non va scritto: finisce in valori-non-mappati.csv, così
// emerge già nel dry-run e l'apply non si ferma a metà.
const COLUMN_FORMATS = await (async () => {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/openapi+json",
    },
  })
  if (!response.ok) throw new Error(`Schema PostgREST: HTTP ${response.status}`)
  const { definitions } = await response.json()
  const formats = {}
  for (const module of Object.values(MODULES)) {
    const properties = definitions?.[module.table]?.properties
    if (!properties) throw new Error(`Schema PostgREST senza la tabella ${module.table}`)
    formats[module.table] = new Map(Object.entries(properties).map(([column, def]) => [column, def.format]))
  }
  return formats
})()

const NUMERIC_FORMATS = new Set(["numeric", "double precision", "real"])
const INTEGER_FORMATS = new Set(["integer", "bigint", "smallint"])
const DECIMAL_TEXT = /^[+-]?\d+(?:[.,]\d+)?$/
const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/

// → { ok, value (eventualmente convertito), reason }
function dbValue(name, column, value) {
  const format = COLUMN_FORMATS[MODULES[name].table].get(column)
  if (value === null || value === undefined || !format) return { ok: true, value }
  if (NUMERIC_FORMATS.has(format) || INTEGER_FORMATS.has(format)) {
    let number = null
    if (typeof value === "number") number = value
    else if (DECIMAL_TEXT.test(String(value).trim())) number = Number(String(value).trim().replace(",", "."))
    if (number === null || !Number.isFinite(number)) return { ok: false, reason: `non è un numero (${format})` }
    if (INTEGER_FORMATS.has(format) && !Number.isInteger(number)) return { ok: false, reason: `non è un intero (${format})` }
    return { ok: true, value: number }
  }
  if (format === "boolean") {
    const bool = typeof value === "boolean" ? value : booleanValue(value)
    return bool === null ? { ok: false, reason: "non è un booleano" } : { ok: true, value: bool }
  }
  if (format === "date") {
    const text = String(value).trim().slice(0, 10)
    const valid = DATE_TEXT.test(text) && !Number.isNaN(new Date(`${text}T00:00:00Z`).valueOf())
    return valid ? { ok: true, value: text } : { ok: false, reason: "non è una data" }
  }
  if (format.startsWith("timestamp")) {
    return Number.isNaN(new Date(value).valueOf()) ? { ok: false, reason: "non è una data/ora" } : { ok: true, value }
  }
  return { ok: true, value }
}

// Tendina + tipo della colonna, nello stesso ordine in create e update.
function writableValue(name, column, value) {
  const option = canonicalOption(name, column, value)
  if (!option.ok) return { ok: false, reason: "non corrisponde a un'opzione della tendina" }
  return dbValue(name, column, option.value)
}

// Ultima difesa prima di ogni insert/update: nessun valore rifiutabile dal DB.
function assertDbValues(name, payload) {
  const invalid = Object.entries(payload).filter(([column, value]) => !dbValue(name, column, value).ok)
  if (invalid.length > 0) {
    throw new Error(`${name}: valori non validi per il DB (${invalid.map(([c, v]) => `${c}=${v}`).join(", ")})`)
  }
}

const unmappedRows = []

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
  return {
    links,
    ambiguous,
    withCandidates: new Set(proposals.map((p) => p.zohoId)),
    ambiguousIds: new Set(ambiguous.map((p) => p.zohoId)),
  }
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
  // Tendine: solo opzioni già esistenti; numeri, date e booleani solo se
  // validi per la colonna. Gli altri valori non vengono scritti.
  const unmapped = []
  for (const [column, value] of Object.entries(record)) {
    const checked = writableValue(name, column, value)
    if (checked.ok) record[column] = checked.value
    else {
      unmapped.push({ column, value, reason: checked.reason })
      delete record[column]
    }
  }
  Object.defineProperty(record, "unmapped", { value: unmapped, enumerable: false })
  return record
}

function logUnmapped(name, id, nome, unmapped) {
  for (const { column, value, reason } of unmapped) {
    unmappedRows.push({ tipo: MODULES[name].label, id, nome, campo: column, valore_zoho: value, motivo: reason })
  }
}

// Lead/cliente collegato a un compito: "Correlato a" e, in mancanza, "Nome
// contatto" (in Zoho può puntare a un lead). null = nessun collegamento valido.
function compitoCorrelato(record, leadIds, clienteIds) {
  for (const column of ["correlato_zoho_id", "nome_contatto_zoho_id"]) {
    const zohoId = normalizeZohoId(record[column])
    if (!zohoId) continue
    const lead = leadIds.get(zohoId)
    const cliente = clienteIds.get(zohoId)
    if (lead && cliente) return { ambiguous: true, zohoId }
    if (lead) return { id: lead, tipo: "lead", zohoId }
    if (cliente) return { id: cliente, tipo: "cliente", zohoId }
  }
  return null
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

async function insertRecords(name, records) {
  for (const record of records) {
    assertWritable(name, "create", record)
    assertDbValues(name, record)
  }
  const inserted = []
  for (let i = 0; i < records.length; i += 100) {
    const { data, error } = await supabase
      .from(MODULES[name].table)
      .insert(records.slice(i, i + 100))
      .select(`id,${MODULES[name].key}`)
    if (error) throw new Error(`Inserimento ${name}: ${error.message}`)
    inserted.push(...(data ?? []))
  }
  return inserted
}

function fieldCounts(records) {
  const counts = {}
  for (const record of records) {
    for (const [column, value] of Object.entries(record)) {
      if (value !== null && value !== undefined && value !== "") counts[column] = (counts[column] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

async function stepCreate() {
  const { withCandidates, ambiguousIds } = computeLinks()
  const report = []
  const summary = {}
  const plan = {}
  const missing = (name) => [...backup[name]].filter(([zohoId]) => !crm[name].byZohoId.has(zohoId))

  for (const name of ["clienti", "leads"]) {
    const absent = missing(name)
    const toCreate = name === "leads" ? absent.filter(([zohoId]) => !withCandidates.has(zohoId)) : absent
    plan[name] = toCreate.map(([zohoId, row]) => ({ zohoId, row, record: buildNewRecord(name, zohoId, row) }))
    summary[name] = { assentiNelCrm: absent.length, daCreare: toCreate.length }
  }
  const leadsAbsent = missing("leads")
  summary.leads.ambigui_soloReport = leadsAbsent.filter(([z]) => ambiguousIds.has(z)).length
  summary.leads.rinviatiAlLink = leadsAbsent.filter(([z]) => withCandidates.has(z) && !ambiguousIds.has(z)).length

  // Compiti: solo se collegati a un lead/cliente del CRM (o creato qui sopra).
  const pending = "(creato in questo step)"
  const leadIds = new Map([...crm.leads.byZohoId].map(([z, r]) => [z, r.id]))
  const clienteIds = new Map([...crm.clienti.byZohoId].map(([z, r]) => [z, r.id]))
  for (const { zohoId } of plan.leads) leadIds.set(zohoId, pending)
  for (const { zohoId } of plan.clienti) clienteIds.set(zohoId, pending)
  const compitiAbsent = missing("compiti")
  plan.compiti = []
  const noCorrelato = []
  for (const [zohoId, row] of compitiAbsent) {
    const record = buildNewRecord("compiti", zohoId, row)
    const correlato = compitoCorrelato(record, leadIds, clienteIds)
    if (correlato && !correlato.ambiguous) plan.compiti.push({ zohoId, row, record })
    else noCorrelato.push({ zohoId, record, ambiguous: Boolean(correlato?.ambiguous) })
  }
  summary.compiti = { assentiNelCrm: compitiAbsent.length, daCreare: plan.compiti.length, no_correlato: noCorrelato.length }

  for (const name of ["clienti", "leads", "compiti"]) {
    summary[name].campi = fieldCounts(plan[name].map((item) => item.record))
    const unmapped = plan[name].flatMap(({ record }) => record.unmapped)
    if (unmapped.length > 0) summary[name].valoriNonMappati = countBy(unmapped, (item) => item.column)
    for (const { zohoId, record } of plan[name]) {
      logUnmapped(name, `zoho:${zohoId}`, MODULES[name].nameOf(record), record.unmapped)
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
  for (const { zohoId, record, ambiguous } of noCorrelato) {
    report.push({
      azione: "no_correlato",
      modulo: "compito",
      id_crm: "",
      zoho_id: zohoId,
      nome: record.oggetto,
      campi: `${ambiguous ? "id presente sia tra i lead sia tra i clienti; " : ""}correlato_zoho_id=${formatValue(record.correlato_zoho_id)} | nome_contatto_zoho_id=${formatValue(record.nome_contatto_zoho_id)}`,
    })
  }
  for (const [zohoId, row] of leadsAbsent.filter(([z]) => withCandidates.has(z))) {
    report.push({
      azione: ambiguousIds.has(zohoId) ? "ambiguo" : "rinviato al link",
      modulo: "lead",
      id_crm: "",
      zoho_id: zohoId,
      nome: row["Nome e cognome"],
      campi: "",
    })
  }

  if (apply) {
    for (const { zohoId } of plan.clienti) clienteIds.delete(zohoId)
    for (const { zohoId } of plan.leads) leadIds.delete(zohoId)
    for (const inserted of await insertRecords("clienti", plan.clienti.map((item) => item.record))) {
      clienteIds.set(normalizeZohoId(inserted.zoho_record_id), inserted.id)
    }
    const insertedLeads = []
    for (const inserted of await insertRecords("leads", plan.leads.map((item) => item.record))) {
      leadIds.set(inserted.zoho_id, inserted.id)
      insertedLeads.push({ id: inserted.id, row: backup.leads.get(inserted.zoho_id) })
    }
    summary.leads.tagAssegnati = await assignLeadTags(insertedLeads)
    const compiti = plan.compiti.map(({ record }) => {
      const correlato = compitoCorrelato(record, leadIds, clienteIds)
      return { ...record, correlato_id: correlato.id, correlato_tipo: correlato.tipo }
    })
    await insertRecords("compiti", compiti)
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
  const summary = {
    leadCrmSenzaZohoId: crm.leads.rows.filter((lead) => !lead.zoho_id).length,
    leadZohoAssentiNelCrm: [...backup.leads.keys()].filter((z) => !crm.leads.byZohoId.has(z)).length,
    daCollegare: links.length,
    perCriterio: links.reduce((acc, link) => ((acc[link.level] = (acc[link.level] ?? 0) + 1), acc), {}),
    ambigui_soloReport: ambiguous.length,
    campi: { zoho_id: links.length },
  }

  if (apply) {
    let written = 0
    await pool(
      links,
      async (link) => {
        // Guardia: collega solo se il lead è ancora senza zoho_id.
        assertWritable("leads", "update", { zoho_id: link.zohoId })
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
    summary.collegati = written
    crm = await loadCrm()
  } else {
    // Dry-run: simula il collegamento, così l'update vede anche questi lead.
    for (const link of links) {
      link.lead.zoho_id = link.zohoId
      crm.leads.byZohoId.set(link.zohoId, link.lead)
    }
  }
  return { report, summary }
}

// ─── Step update: merge a tre vie / fix-decimali ────────────────────────────
//
// Base = valore del campo al momento dell'import da Zoho, letto dagli export
// Zoho usati dagli import (--base-dir, default ~/Downloads: Lead_*/Leads_*,
// Clienti_*, Compiti_* in .csv o .zip con dentro un .csv). Il CRM non ha uno
// storico campo per campo (attivita.campo è sempre vuoto, audit_log non
// salva dati_prima), quindi non è una fonte possibile.
// Per ogni record si usa la versione dell'export il cui orario di modifica
// coincide con quello salvato nel CRM (zoho_modified_at; compiti: ora_modifica).
//
// Per campo, con B = base, Z = backup, C = CRM:
//   Z vuoto               → niente (un vuoto Zoho non svuota mai il CRM)
//   Z == C                → niente
//   ora_ultima_attivita, ora_modifica → vince il più recente tra Z e C
//   stato_lead            → sempre Z
//   C vuoto               → Z (un vuoto CRM non è una modifica: l'import non
//                           popolava alcuni campi)
//   Z == B                → niente (al massimo è cambiato solo il CRM)
//   Z != B, C == B        → Z
//   Z != B, C != B, C != Z → conflitto: campaign_name vince il CRM; descrizione
//                           = testo CRM + riga vuota + testo Zoho (se non già
//                           contenuto); gli altri campi in revisione.csv
//                           (+ revisione-clienti.csv / revisione-lead.csv).
// Record senza base (lead nati nel CRM e collegati): solo i campi vuoti nel
// CRM, più stato_lead. Tendine: solo opzioni già esistenti nel CRM, gli altri
// valori in valori-non-mappati.csv. Proprietari mai aggiornati.

// I proprietari non si aggiornano mai da Zoho (né l'uuid né i riferimenti Zoho).
const OWNER_COLUMNS = {
  clienti: new Set(["clienti_proprietario_id", "clienti_proprietario_zoho_id", "clienti_proprietario"]),
  leads: new Set(["lead_proprietario_id", "zoho_owner_id"]),
  compiti: new Set(["proprietario_id", "proprietario_zoho_id", "proprietario_nome"]),
}
const EMAIL_COLUMNS = new Set(["email", "e_mail_secondaria", "e_mail_enel_gaudi"])

const BASE_FILE_PATTERNS = {
  leads: /^Leads?_(\d{4}_\d{2}_\d{2})\.(csv|zip)$/,
  clienti: /^Clienti_(\d{4}_\d{2}_\d{2})\.(csv|zip)$/,
  compiti: /^Compiti_(\d{4}_\d{2}_\d{2})\.(csv|zip)$/,
}

const baseDir = resolve(expandHome(argument("base-dir") ?? "~/Downloads"))

async function readBaseFile(path) {
  if (path.endsWith(".csv")) {
    return parse(readFileSync(path), { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true })
  }
  const { stdout: listing } = await execFileAsync("unzip", ["-Z1", path], { encoding: "utf8" })
  const entry = listing.split("\n").find((name) => name.endsWith(".csv"))
  if (!entry) return null
  const { stdout } = await execFileAsync("unzip", ["-p", path, entry], { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 })
  return parse(stdout, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true })
}

// Versioni base per modulo: zohoId → [{ file, row }], dalla più recente.
async function loadBaseVersions() {
  const files = readdirSync(baseDir)
  const versions = {}
  const used = {}
  for (const [name, pattern] of Object.entries(BASE_FILE_PATTERNS)) {
    // Una sola fonte per data: il .csv se c'è (lo zip ne è la copia compressa).
    const byDate = new Map()
    for (const file of files) {
      const match = file.match(pattern)
      if (!match) continue
      if (!byDate.has(match[1]) || match[2] === "csv") byDate.set(match[1], file)
    }
    versions[name] = new Map()
    used[name] = []
    for (const [, file] of [...byDate].sort((a, b) => b[0].localeCompare(a[0]))) {
      const rows = await readBaseFile(join(baseDir, file))
      if (!rows) continue
      used[name].push(`${file} (${rows.length})`)
      for (const row of rows) {
        const zohoId = normalizeZohoId(row["ID record"])
        if (!zohoId) continue
        if (!versions[name].has(zohoId)) versions[name].set(zohoId, [])
        versions[name].get(zohoId).push({ file, row })
      }
    }
  }
  return { versions, used }
}

// Record mai modificato nel CRM dopo l'import (compiti: nessun zoho_modified_at,
// l'import ha scritto created_at = updated_at).
function untouchedInCrm(name, record) {
  const aligned = name === "compiti" ? record.created_at : record.zoho_modified_at
  return Boolean(aligned && record.updated_at) && millis(record.updated_at) <= millis(aligned) + 1000
}

function crmReference(name, record) {
  return millis(name === "compiti" ? record.ora_modifica : record.zoho_modified_at)
}

function versionStamp(name, row) {
  const module = MODULES[name]
  const raw = name === "compiti"
    ? row["Ora modifica"]
    : row["Orario del registro delle modifiche"] ?? row["Ora modifica"]
  return millis(module.timestamp(raw))
}

function findBase(name, record, zohoId) {
  const reference = crmReference(name, record)
  if (reference === null) return null
  return (baseVersions[name].get(zohoId) ?? []).find(({ row }) => versionStamp(name, row) === reference) ?? null
}

// Il vecchio import clienti toglieva i punti dai numeri ("6.37" → 637): nel
// confronto con la base quel valore vale come "non modificato nel CRM".
function legacyClienteNumber(raw) {
  const normalized = String(raw ?? "").trim().replace(/\./g, "").replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const NUMERIC_TEXT = /^-?\d+(?:\.\d+)?$/

function sameForMerge(field, a, b) {
  if (EMAIL_COLUMNS.has(field.column)) {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()
  }
  // Campi testo con numeri: il backup scrive "2500.0" dove l'export aveva "2500".
  const textA = String(a ?? "").trim()
  const textB = String(b ?? "").trim()
  if (NUMERIC_TEXT.test(textA) && NUMERIC_TEXT.test(textB)) return Number(textA) === Number(textB)
  return sameValue(field, a, b)
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === ""
}

function rawValue(field, row) {
  const header = fieldHeaders(field).find((name) => name in row)
  return header === undefined ? undefined : row[header]
}

// Campi confrontabili di un modulo: mapping + riferimenti non-proprietari.
function mergeFields(name) {
  const owners = OWNER_COLUMNS[name]
  const fields = MODULES[name].fields.filter(
    (field) => !owners.has(field.column) && field.column !== "zoho_modified_at",
  )
  const refs = Object.keys(resolvedRefs(name, {}))
    .filter((column) => !owners.has(column))
    .map((column) => ({ column, type: "ref" }))
  const all = [...fields, ...refs]
  return campiFilter ? all.filter((field) => campiFilter.has(field.column)) : all
}

function fieldValue(name, field, row) {
  const value = field.type === "ref"
    ? resolvedRefs(name, row)[field.column]
    : zohoFieldValue(MODULES[name], field, row)
  if (value === undefined || value === null) return value
  return canonicalOption(name, field.column, value).value
}

// Campi che lo script può scrivere: solo quelli del mapping Zoho → CRM (più le
// colonne tecniche di allineamento). Ogni scrittura viene verificata qui.
let WRITABLE = null

function writableColumns() {
  const result = {}
  for (const [name, module] of Object.entries(MODULES)) {
    const update = new Set([...mergeFields(name).map((field) => field.column), "zoho_modified_at"])
    if (name === "clienti") for (const field of NUMERIC_CLIENTE_FIELDS) update.add(field.column)
    if (name === "leads") update.add("zoho_id")
    const create = new Set([
      module.key,
      ...module.fields.map((field) => field.column),
      ...Object.keys(resolvedRefs(name, {})),
      "created_at",
      "updated_at",
      ...(name === "clienti" ? ["ora_modifica"] : []),
      ...(name === "compiti" ? ["correlato_id", "correlato_tipo"] : []),
    ])
    result[name] = { update, create }
  }
  return result
}

function assertWritable(name, kind, payload) {
  const allowed = WRITABLE[name][kind]
  const outside = Object.keys(payload).filter((column) => !allowed.has(column))
  if (outside.length > 0) {
    throw new Error(`${name}: tentata scrittura di campi fuori mapping (${outside.join(", ")})`)
  }
}

const fieldRows = []
const reviewRows = []
let baseVersions = null
let baseSources = null

function recordChanges(step, name, record, changes) {
  const module = MODULES[name]
  for (const change of changes) {
    fieldRows.push({
      step,
      tipo: module.label,
      id: record.id,
      nome: module.nameOf(record),
      campo: change.column,
      regola: change.rule,
      valore_crm: change.from,
      valore_zoho: change.to,
    })
  }
}

function countBy(items, key) {
  const counts = {}
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

async function writeChanges(writes, label) {
  let written = 0
  await pool(
    writes,
    async ({ name, record, payload }) => {
      assertWritable(name, "update", payload)
      assertDbValues(name, payload)
      const { data, error } = await supabase
        .from(MODULES[name].table)
        .update(payload)
        .eq("id", record.id)
        .select("id")
      if (error) throw new Error(`${label} ${name} ${record.id}: ${error.message}`)
      written += data?.length ?? 0
    },
    label,
  )
  return written
}

// Orari di sistema: vince il più recente tra Zoho e CRM, mai in revisione.
const LATEST_WINS = new Set(["ora_ultima_attivita", "ora_modifica"])

function normalizedText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

// Conflitto su descrizione: testo CRM + testo Zoho (riga vuota), se non già contenuto.
function appendDescrizione(crmValue, zohoValue) {
  if (normalizedText(crmValue).includes(normalizedText(zohoValue))) return crmValue
  return `${String(crmValue).trimEnd()}\n\n${String(zohoValue).trim()}`
}

function mergeRecord(name, record, row, base) {
  const changes = []
  const reviews = []
  const unmapped = []
  const resolved = []
  let baseMismatch = []
  const propose = (column, from, to, rule) => {
    const checked = writableValue(name, column, to)
    if (!checked.ok) unmapped.push({ column, value: to, reason: checked.reason })
    else changes.push({ column, from, to: checked.value, rule })
  }
  for (const field of mergeFields(name)) {
    const zoho = fieldValue(name, field, row)
    if (zoho === undefined || zoho === null) continue
    const column = field.column
    const crmValue = record[column]
    if (sameForMerge(field, crmValue, zoho)) continue

    if (zohoVince) {
      propose(column, crmValue, zoho, "Zoho vince (--zoho-vince)")
      continue
    }

    if (LATEST_WINS.has(column)) {
      if (isEmpty(crmValue) || millis(zoho) > millis(crmValue)) propose(column, crmValue, zoho, "orario più recente")
      continue
    }
    if (name === "leads" && column === "stato_lead") {
      propose(column, crmValue, zoho, "stato_lead sempre da Zoho")
      continue
    }

    if (!base || (field.type !== "ref" && rawValue(field, base.row) === undefined)) {
      // Senza base per il campo (es. lead nati nel CRM): solo se il CRM è vuoto.
      if (isEmpty(crmValue)) propose(column, crmValue, zoho, "vuoto nel CRM")
      continue
    }

    const baseValue = fieldValue(name, field, base.row)
    if (isEmpty(crmValue)) {
      // Campo vuoto nel CRM: non lo consideriamo una modifica utente (l'import
      // non popolava alcuni campi, es. iva, installatore_id, rating).
      propose(column, crmValue, zoho, "vuoto nel CRM")
      continue
    }
    if (sameForMerge(field, baseValue, zoho)) continue
    const crmUnchanged =
      sameForMerge(field, baseValue, crmValue) ||
      (name === "clienti" && field.type === "numeric" &&
        legacyClienteNumber(rawValue(field, base.row)) === Number(crmValue))
    if (crmUnchanged) {
      propose(column, crmValue, zoho, "cambiato solo in Zoho")
    } else if (column === "campaign_name") {
      resolved.push({ column, rule: "conflitto: vince il CRM" })
    } else if (column === "descrizione") {
      const merged = appendDescrizione(crmValue, zoho)
      if (merged === crmValue) resolved.push({ column, rule: "conflitto: testo Zoho già contenuto" })
      else propose(column, crmValue, merged, "conflitto: descrizione accodata")
    } else {
      reviews.push({ column, base: baseValue, zoho, crm: crmValue })
    }
  }
  if (base && untouchedInCrm(name, record)) {
    // Record mai toccato nel CRM: C deve coincidere con B. Se no, è un artefatto
    // dell'import (diagnostica per verificare la base).
    baseMismatch = mergeFields(name)
      .filter((field) => field.type === "ref" || rawValue(field, base.row) !== undefined)
      .filter((field) => {
        const baseValue = fieldValue(name, field, base.row)
        if (baseValue === null && isEmpty(record[field.column])) return false
        if (name === "clienti" && field.type === "numeric" && record[field.column] !== null &&
            legacyClienteNumber(rawValue(field, base.row)) === Number(record[field.column])) return false
        return !sameForMerge(field, baseValue, record[field.column])
      })
      .map((field) => field.column)
  }
  return { changes, reviews, unmapped, resolved, baseMismatch }
}

async function stepUpdate() {
  if (campiFilter) {
    const noti = new Set(Object.values(MODULES).flatMap((module) => module.fields.map((field) => field.column)))
    const ignoti = [...campiFilter].filter((column) => !noti.has(column))
    if (ignoti.length > 0) throw new Error(`--campi: colonne non presenti nel mapping: ${ignoti.join(", ")}`)
    console.log(
      `Update limitato a: ${[...campiFilter].join(", ")}` +
        (moduliFilter ? ` | moduli: ${[...moduliFilter].join(", ")}` : "") +
        (soloMultipli ? " | solo record con più valori in Zoho" : "") +
        (zohoVince ? " | Zoho vince" : ""),
    )
  }
  const summary = { fontiBase: baseSources }
  const writes = []
  for (const name of ["clienti", "leads", "compiti"].filter((modulo) => !moduliFilter || moduliFilter.has(modulo))) {
    const module = MODULES[name]
    const counts = {
      inComune: 0,
      conBase: 0,
      senzaBase_natiNelCrm: 0,
      senzaBase_versioneNonTrovata: 0,
      recordAggiornati: 0,
      recordConRevisione: 0,
    }
    const allChanges = []
    const allReviews = []
    const allUnmapped = []
    const allResolved = []
    const mismatches = []
    let untouchedChecked = 0
    for (const [zohoId, row] of backup[name]) {
      const record = crm[name].byZohoId.get(zohoId)
      if (!record) continue
      if (soloMultipli && !mergeFields(name).some((field) => String(rawValue(field, row) ?? "").includes(";"))) continue
      counts.inComune += 1
      const base = findBase(name, record, zohoId)
      if (base) counts.conBase += 1
      else if (name === "leads" && record.zoho_modified_at == null) counts.senzaBase_natiNelCrm += 1
      else counts.senzaBase_versioneNonTrovata += 1

      const { changes, reviews, unmapped, resolved, baseMismatch } = mergeRecord(name, record, row, base)
      logUnmapped(name, record.id, module.nameOf(record), unmapped)
      allUnmapped.push(...unmapped)
      allResolved.push(...resolved)
      if (base && untouchedInCrm(name, record)) {
        untouchedChecked += 1
        mismatches.push(...baseMismatch)
      }
      for (const review of reviews) {
        reviewRows.push({
          tipo: module.label,
          id: record.id,
          nome: module.nameOf(record),
          campo: review.column,
          base: review.base,
          zoho: review.zoho,
          crm: review.crm,
        })
      }
      allReviews.push(...reviews)
      if (reviews.length > 0) counts.recordConRevisione += 1

      // zoho_modified_at avanza solo se non resta nulla in revisione.
      const zohoModified = [
        module.timestamp(row["Orario del registro delle modifiche"]),
        module.timestamp(row["Ora modifica"]),
      ].filter(Boolean).sort().at(-1)
      if (!campiFilter && reviews.length === 0 && zohoModified &&
          (record.zoho_modified_at == null || millis(zohoModified) > millis(record.zoho_modified_at))) {
        changes.push({ column: "zoho_modified_at", from: record.zoho_modified_at, to: zohoModified, rule: "riferimento Zoho" })
      }
      if (changes.length === 0) continue
      if (changes.some((change) => change.column !== "zoho_modified_at")) counts.recordAggiornati += 1
      allChanges.push(...changes)
      recordChanges("update", name, record, changes)
      const payload = Object.fromEntries(changes.map(({ column, to }) => [column, to]))
      writes.push({ name, record, payload })
      // Stato simulato per gli step successivi (fix-decimali) nello stesso run.
      Object.assign(record, payload)
    }
    counts.aggiornamentiPerCampo = countBy(allChanges, (change) => change.column)
    counts.aggiornamentiPerRegola = countBy(allChanges, (change) => change.rule)
    counts.revisionePerCampo = countBy(allReviews, (review) => review.column)
    counts.conflittiRisoltiSenzaRevisione = countBy(allResolved, (item) => `${item.column}: ${item.rule}`)
    counts.valoriNonMappatiPerCampo = countBy(allUnmapped, (item) => item.column)
    counts.verificaBase = {
      recordMaiModificatiNelCrm: untouchedChecked,
      campiCrmDiversiDallaBase: countBy(mismatches.map((column) => ({ column })), (item) => item.column),
    }
    summary[name] = counts
  }
  if (apply) {
    summary.scritti = await writeChanges(writes, "update")
    crm = await loadCrm()
  }
  return { summary }
}

// fix-decimali: corregge solo i numeri rovinati dal vecchio import clienti
// (valore CRM = valore Zoho senza punto decimale). Le altre differenze
// numeriche restano al merge a tre vie.
const NUMERIC_CLIENTE_FIELDS = CLIENTE_FIELDS.filter((field) => field.type === "numeric")

async function stepFixDecimali() {
  const writes = []
  const allChanges = []
  let inComune = 0
  let altreDifferenze = 0
  for (const [zohoId, row] of backup.clienti) {
    const record = crm.clienti.byZohoId.get(zohoId)
    if (!record) continue
    inComune += 1
    const changes = []
    for (const field of NUMERIC_CLIENTE_FIELDS) {
      const value = zohoFieldValue(MODULES.clienti, field, row)
      if (value === undefined || value === null || record[field.column] === null) continue
      if (sameValue(field, record[field.column], value)) continue
      if (legacyClienteNumber(rawValue(field, row)) !== Number(record[field.column])) {
        altreDifferenze += 1
        continue
      }
      const checked = dbValue("clienti", field.column, value)
      if (!checked.ok) {
        logUnmapped("clienti", record.id, MODULES.clienti.nameOf(record), [{ column: field.column, value, reason: checked.reason }])
        continue
      }
      changes.push({ column: field.column, from: record[field.column], to: checked.value, rule: "decimale perso nell'import" })
    }
    if (changes.length === 0) continue
    allChanges.push(...changes)
    recordChanges("fix-decimali", "clienti", record, changes)
    const payload = Object.fromEntries(changes.map(({ column, to }) => [column, to]))
    writes.push({ name: "clienti", record, payload })
    Object.assign(record, payload)
  }
  const summary = {
    clienti: {
      inComune,
      recordCorretti: writes.length,
      correzioniPerCampo: countBy(allChanges, (change) => change.column),
      altreDifferenzeNumeriche_nonToccate: altreDifferenze,
    },
  }
  if (apply) {
    summary.scritti = await writeChanges(writes, "fix-decimali")
    crm = await loadCrm()
  }
  return { summary }
}

function writeCsv(name, header, rows) {
  const lines = [header.join(",")]
  for (const row of rows) lines.push(header.map((key) => csvCell(row[key])).join(","))
  const path = join(outDir, name)
  writeFileSync(path, `﻿${lines.join("\n")}\n`, "utf8")
  return path
}

// Una riga per record, con base / Zoho / CRM affiancati per ogni campo in conflitto.
function reviewSummary(tipo, routePath) {
  const rows = reviewRows.filter((row) => row.tipo === tipo)
  const fields = Object.keys(countBy(rows, (row) => row.campo))
  const byRecord = new Map()
  for (const row of rows) {
    if (!byRecord.has(row.id)) byRecord.set(row.id, { id: row.id, nome: row.nome, scheda: `/${routePath}/${row.id}`, conflicts: {} })
    byRecord.get(row.id).conflicts[row.campo] = row
  }
  const header = ["nome", "scheda", "n_campi", "campi_in_conflitto", ...fields.flatMap((field) => [`${field} · base`, `${field} · Zoho`, `${field} · CRM`]), "id"]
  const out = [...byRecord.values()]
    .sort((a, b) => String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "it"))
    .map((record) => {
      const line = {
        nome: record.nome,
        scheda: record.scheda,
        n_campi: Object.keys(record.conflicts).length,
        campi_in_conflitto: Object.keys(record.conflicts).join(", "),
        id: record.id,
      }
      for (const field of fields) {
        const conflict = record.conflicts[field]
        line[`${field} · base`] = conflict?.base ?? ""
        line[`${field} · Zoho`] = conflict?.zoho ?? ""
        line[`${field} · CRM`] = conflict?.crm ?? ""
      }
      return line
    })
  return { header, rows: out }
}

// ─── Main ───────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true })
WRITABLE = writableColumns()
console.log("Campi che lo script può scrivere (qualunque altro campo non viene mai toccato):")
for (const [name, { update, create }] of Object.entries(WRITABLE)) {
  const onlyCreate = [...create].filter((column) => !update.has(column))
  console.log(`  ${name} — update/link/fix-decimali (${update.size}): ${[...update].sort().join(", ")}`)
  console.log(`  ${name} — in più solo alla creazione (${onlyCreate.length}): ${onlyCreate.sort().join(", ")}`)
}
console.log("  create lead: anche tabelle tag (solo nuovi tag lead) e lead_tags (solo per i lead creati).")
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
  } else if (step === "update") {
    ;({ versions: baseVersions, used: baseSources } = await loadBaseVersions())
    console.log(JSON.stringify((await stepUpdate()).summary, null, 2))
  } else {
    console.log(JSON.stringify((await stepFixDecimali()).summary, null, 2))
  }
}

if (steps.includes("update") || steps.includes("fix-decimali")) {
  const campi = writeCsv("update-campi.csv", ["step", "tipo", "id", "nome", "campo", "regola", "valore_crm", "valore_zoho"], fieldRows)
  console.log(`\n→ ${campi} (${fieldRows.length} righe)`)
}
if (steps.includes("update")) {
  const revisione = writeCsv("revisione.csv", ["tipo", "id", "nome", "campo", "base", "zoho", "crm"], reviewRows)
  console.log(`→ ${revisione} (${reviewRows.length} righe)`)
  for (const [tipo, file, path] of [["cliente", "revisione-clienti.csv", "clienti"], ["lead", "revisione-lead.csv", "leads"]]) {
    const { header, rows } = reviewSummary(tipo, path)
    console.log(`→ ${writeCsv(file, header, rows)} (${rows.length} record)`)
  }
}
if (steps.includes("create") || steps.includes("update")) {
  const nonMappati = writeCsv("valori-non-mappati.csv", ["tipo", "id", "nome", "campo", "valore_zoho", "motivo"], unmappedRows)
  console.log(`→ ${nonMappati} (${unmappedRows.length} righe)`)
}

if (!apply) console.log("\nDry-run completato: nessun dato scritto. Aggiungi --apply per scrivere.")
