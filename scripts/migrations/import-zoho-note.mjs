// Import delle note Zoho nella timeline del CRM (public.attivita, tipo "nota").
//
// Sorgente: backup completo Zoho (Data_001.zip → Data/Notes_001.csv, con
// Data/Users_001.csv per autori e menzioni e Metadata/Roles_001.csv per le
// menzioni di ruolo).
//
// Collegamento al record (Parent Id.Module):
//   Contacts       → cliente      (clienti.zoho_record_id)
//   Leads          → lead         (leads.zoho_id)
//   Tasks          → compito      (compiti.zoho_record_id, salvato con "zcrm_")
//   CustomModule2  → installatore (installatori.zoho_id)
//   CustomModule1 (Scadenze) e ogni altro modulo: non importati, solo report.
// Gli ID sono confrontati senza prefisso "zcrm_" da entrambe le parti.
//
// Testo: titolo (se c'è) in testa, HTML ridotto a testo semplice, menzioni
// crm[user#…]crm / crm[role#…]crm → @Nome. Autore: utente CRM con lo stesso
// zoho_id o la stessa email dell'utente Zoho "Creato da"; se manca, autore
// null (la timeline mostra "Sistema") e nome Zoho in testa al testo.
// La colonna menzioni resta vuota: le note storiche non generano notifiche.
//
// Data: "Ora creazione" Zoho in wall-clock italiano salvato come UTC, stessa
// convenzione di clienti e lead (vedi final-zoho-delta.mjs).
//
// Idempotente via attivita.zoho_note_id (supabase/migrations/20260925_attivita_zoho_note_id.sql):
// una nota già importata è "skip_presente"; l'insert usa comunque
// onConflict + ignoreDuplicates. Le note nate nel CRM non vengono lette né toccate.
//
// Nessuna cancellazione, nessuna modifica. Default dry-run: scrive solo il report.
// Uso:
//   node --env-file=.env.local scripts/migrations/import-zoho-note.mjs \
//     --backup ~/migrazione-finale/zoho-backup [--out <cartella>] [--apply]
import { execFile } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

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
if (!backupArg) {
  console.error("Uso: import-zoho-note.mjs --backup <cartella> [--out <cartella>] [--apply]")
  process.exit(1)
}
const backupDir = resolve(expandHome(backupArg))
const zipPath = join(backupDir, "Data_001.zip")
const outDir = resolve(
  expandHome(argument("out") ?? join(dirname(backupDir), "import-note-report")),
)
const BATCH_SIZE = 500

// ─── Moduli ─────────────────────────────────────────────────────────────────

const MODULI = {
  Contacts: { recordTipo: "cliente", table: "clienti", key: "zoho_record_id" },
  Leads: { recordTipo: "lead", table: "leads", key: "zoho_id" },
  Tasks: { recordTipo: "compito", table: "compiti", key: "zoho_record_id" },
  CustomModule2: { recordTipo: "installatore", table: "installatori", key: "zoho_id" },
}
const NOMI_MODULO = {
  Contacts: "Clienti",
  Leads: "Lead",
  Tasks: "Compiti",
  CustomModule1: "Scadenze",
  CustomModule2: "Installatori",
}

// ─── Normalizzatori ─────────────────────────────────────────────────────────

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function nullable(value) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

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

const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return ENTITA[entity.toLowerCase()] ?? match
  })
}

// Solo tag veri: un "<5 kW" scritto nel testo non va mangiato.
const TAG = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/gi

function htmlToText(html) {
  const text = String(html ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li(?:\s[^<>]*)?>/gi, "\n• ")
    .replace(/<\/(?:p|div|li|ul|ol)>/gi, "\n")
    .replace(TAG, "")
  return decodeEntities(text)
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
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

async function fetchAll(table, columns, filter = (query) => query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(supabase.from(table).select(columns))
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

function writeCsv(name, header, rows) {
  const lines = [header.join(",")]
  for (const row of rows) lines.push(header.map((key) => csvCell(row[key])).join(","))
  const path = join(outDir, name)
  writeFileSync(path, `﻿${lines.join("\n")}\n`, "utf8")
  return path
}

function anteprima(text) {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat
}

// ─── Dati ───────────────────────────────────────────────────────────────────

console.log(`Modalità: ${apply ? "APPLY (scrittura su attivita)" : "dry-run (solo report)"}`)
console.log(`Backup: ${zipPath}`)

const [notes, zohoUsers, zohoRoles] = await Promise.all([
  readBackupCsv("Data/Notes_001.csv"),
  readBackupCsv("Data/Users_001.csv"),
  readBackupCsv("Metadata/Roles_001.csv").catch(() => []),
])
console.log(`Note nel backup: ${notes.length}`)

const zohoUserById = new Map(
  zohoUsers.map((user) => [
    normalizeZohoId(user["ID record"]),
    {
      nome: [user.Nome, user.Cognome].map(nullable).filter(Boolean).join(" ") || null,
      email: nullable(user["E-mail"])?.toLowerCase() ?? null,
    },
  ]),
)
const zohoRoleById = new Map(
  zohoRoles.map((role) => [normalizeZohoId(role["Record Id"]), nullable(role["Role Name"])]),
)

const crmUsers = await fetchAll("utenti", "id,nome,email,zoho_id")
const crmUserByZohoId = new Map(
  crmUsers.filter((user) => user.zoho_id).map((user) => [normalizeZohoId(user.zoho_id), user]),
)
const crmUserByEmail = new Map(
  crmUsers.filter((user) => user.email).map((user) => [user.email.trim().toLowerCase(), user]),
)

// zoho id (senza prefisso) → uuid CRM, per ogni modulo gestito.
const recordIndex = {}
for (const [modulo, config] of Object.entries(MODULI)) {
  const rows = await fetchAll(config.table, `id,${config.key}`, (query) =>
    query.not(config.key, "is", null),
  )
  recordIndex[modulo] = new Map(rows.map((row) => [normalizeZohoId(row[config.key]), row.id]))
  console.log(`${config.table}: ${recordIndex[modulo].size} record con ID Zoho`)
}

const imported = new Set(
  (
    await fetchAll("attivita", "zoho_note_id", (query) => query.not("zoho_note_id", "is", null))
  ).map((row) => row.zoho_note_id),
)
console.log(`Note Zoho già in timeline: ${imported.size}`)

// ─── Conversione ────────────────────────────────────────────────────────────

function crmUserFor(zohoUserId) {
  const byId = crmUserByZohoId.get(zohoUserId)
  if (byId) return byId
  const email = zohoUserById.get(zohoUserId)?.email
  return email ? crmUserByEmail.get(email) ?? null : null
}

function nomeUtenteZoho(zohoUserId) {
  return zohoUserById.get(zohoUserId)?.nome ?? crmUserByZohoId.get(zohoUserId)?.nome ?? null
}

const menzioniNonRisolte = new Set()

function risolviMenzioni(text) {
  return text.replace(/crm\[(user|role)#(\d+)#[^\]]*\]crm/g, (_match, kind, id) => {
    const nome = kind === "user" ? nomeUtenteZoho(id) : zohoRoleById.get(id)
    if (!nome) menzioniNonRisolte.add(`${kind}#${id}`)
    return `@${nome ?? (kind === "user" ? "utente Zoho" : "ruolo Zoho")}`
  })
}

function testoNota(row, autoreZohoSenzaCrm) {
  const titolo = htmlToText(risolviMenzioni(row["Titolo nota"] ?? ""))
  const contenuto = htmlToText(risolviMenzioni(row["Contenuto nota"] ?? ""))
  const parti = []
  if (autoreZohoSenzaCrm) parti.push(`Nota Zoho di ${autoreZohoSenzaCrm}`)
  if (titolo && titolo !== contenuto) parti.push(titolo)
  if (contenuto) parti.push(contenuto)
  return { testo: parti.join("\n\n"), vuota: !titolo && !contenuto }
}

// ─── Piano ──────────────────────────────────────────────────────────────────

const report = []
const daCreare = []
const visti = new Set()
const autoriNonTrovati = new Map()

for (const row of notes) {
  const zohoNoteId = normalizeZohoId(row["ID record"])
  const modulo = nullable(row["Parent Id.Module"]) ?? "?"
  const parentId = normalizeZohoId(row["ID  principale.id"] ?? row["ID principale.id"])
  const config = MODULI[modulo]
  const autoreZohoId = normalizeZohoId(row["Creato da.id"])
  const autore = crmUserFor(autoreZohoId)
  const nomeAutoreZoho = nomeUtenteZoho(autoreZohoId) ?? (autoreZohoId || "utente sconosciuto")
  if (!autore) autoriNonTrovati.set(autoreZohoId, nomeAutoreZoho)
  const { testo, vuota } = testoNota(row, autore ? null : nomeAutoreZoho)
  const recordId = config ? recordIndex[modulo].get(parentId) ?? null : null

  let azione
  if (!zohoNoteId || visti.has(zohoNoteId)) azione = "duplicata_nel_backup"
  else if (!config) azione = "modulo_non_gestito"
  else if (imported.has(zohoNoteId)) azione = "skip_presente"
  else if (!recordId) azione = "record_non_trovato"
  else if (vuota) azione = "vuota"
  else azione = "crea"
  if (zohoNoteId) visti.add(zohoNoteId)

  report.push({
    azione,
    modulo: NOMI_MODULO[modulo] ?? modulo,
    zoho_note_id: zohoNoteId,
    zoho_record_id: parentId,
    record_tipo: config?.recordTipo ?? "",
    record_crm: recordId ?? "",
    autore: autore?.nome ?? `(Zoho) ${nomeAutoreZoho}`,
    data: wallClockTimestamp(row["Ora creazione"]) ?? "",
    anteprima: anteprima(testo),
  })

  if (azione === "crea") {
    daCreare.push({
      tipo: "nota",
      testo,
      formato: "plain",
      record_tipo: config.recordTipo,
      record_id: recordId,
      utente_id: autore?.id ?? null,
      created_at: wallClockTimestamp(row["Ora creazione"]) ?? new Date().toISOString(),
      zoho_note_id: zohoNoteId,
    })
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true })
const reportPath = writeCsv(
  "note.csv",
  ["azione", "modulo", "zoho_note_id", "zoho_record_id", "record_tipo", "record_crm", "autore", "data", "anteprima"],
  report,
)

const AZIONI = ["crea", "skip_presente", "record_non_trovato", "modulo_non_gestito", "vuota", "duplicata_nel_backup"]
const perModulo = new Map()
for (const row of report) {
  if (!perModulo.has(row.modulo)) perModulo.set(row.modulo, Object.fromEntries([["totale", 0], ...AZIONI.map((a) => [a, 0])]))
  const counts = perModulo.get(row.modulo)
  counts.totale += 1
  counts[row.azione] += 1
}
const totali = Object.fromEntries([["totale", 0], ...AZIONI.map((a) => [a, 0])])
for (const counts of perModulo.values()) for (const key of Object.keys(totali)) totali[key] += counts[key]
console.log("\nRiepilogo per modulo:")
console.table(Object.fromEntries([...perModulo.entries(), ["TOTALE", totali]]))

if (autoriNonTrovati.size > 0) {
  console.log(`Autori Zoho senza utente CRM (autore null, nome in testa al testo): ${autoriNonTrovati.size}`)
  for (const [id, nome] of autoriNonTrovati) console.log(`  ${id}  ${nome}`)
}
if (menzioniNonRisolte.size > 0) {
  console.log(`Menzioni senza nome nel backup: ${[...menzioniNonRisolte].join(", ")}`)
}
console.log(`Report: ${reportPath}`)

// ─── Scrittura ──────────────────────────────────────────────────────────────

if (!apply) {
  console.log(`\nDry-run: ${daCreare.length} note da creare. Rilancia con --apply per scriverle.`)
  process.exit(0)
}

let inserite = 0
for (let index = 0; index < daCreare.length; index += BATCH_SIZE) {
  const batch = daCreare.slice(index, index + BATCH_SIZE)
  const { data, error } = await supabase
    .from("attivita")
    .upsert(batch, { onConflict: "zoho_note_id", ignoreDuplicates: true })
    .select("id")
  if (error) {
    throw new Error(
      `Blocco ${index / BATCH_SIZE + 1} non inserito (${inserite} note già scritte, rilancia: le presenti vengono saltate): ${error.message}`,
    )
  }
  inserite += data?.length ?? 0
  console.log(`  ${Math.min(index + BATCH_SIZE, daCreare.length)}/${daCreare.length}`)
}
console.log(`\nNote inserite: ${inserite} su ${daCreare.length} pianificate.`)
