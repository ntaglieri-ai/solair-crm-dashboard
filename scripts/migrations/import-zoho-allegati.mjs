// Import su Nextcloud degli allegati Zoho CRM dal backup locale.
//
// Sorgente (--backup <cartella>):
//   Data_001.zip        → Data/Attachments_001.csv (metadati), Data/Notes_001.csv
//                         e Data/Emails_001.csv per risalire al record padre
//                         degli allegati di note ed email;
//   Attachments_*.zip   → i file, in Attachments/<ID record>. L'ID record è
//                         "<codice>_<nome file>": si cerca per codice, perché
//                         i nomi non ASCII negli zip non sono affidabili.
// Perimetro: Ora creazione >= --since (default 2026-09-01).
//
// Destinazione: cartella Nextcloud del record, stessa convenzione dell'app e
// di backfill-zoho-clienti-allegati.mjs (folderPathForRecord in
// lib/allegati/paths.ts):
//   Contacts (diretti, o tramite nota/email) → cliente (clienti.zoho_record_id)
//   Leads    (diretti, o tramite nota/email) → lead    (leads.zoho_id)
//   altri moduli → solo report.
// Il file si carica nella radice della cartella con il nome Zoho ("Nome file").
//
// Regole:
//   - mai spostare o cancellare, né rinominare file: solo MKCOL (provisioning),
//     PUT di file nuovi e il MOVE delle cartelle simili descritto sotto;
//   - stesso nome + stessa dimensione ovunque nella cartella del record
//     (ricerca ricorsiva) → skip_presente; vale anche per "<nome> (zoho)",
//     così un rilancio non ricarica i file già rinominati;
//   - stesso nome, dimensione diversa → upload_rinominato con " (zoho)",
//     mai sovrascrivere;
//   - cartella assente → se nell'archivio c'è UNA sola cartella con lo stesso
//     nome scritto diversamente ("Rossi Mario" per "Mario Rossi"), viene
//     rinominata nel nome esatto atteso dal CRM (MOVE senza sovrascrittura) e
//     i file vanno lì; se ce n'è più d'una, se la stessa cartella corrisponde a
//     più record o se è già la cartella esatta di un altro cliente → solo
//     report, nessuna azione. Senza cartelle simili, la cartella nasce con
//     provisionaCartellaRecord, la funzione usata dall'app alla creazione di
//     cliente/lead. Nessun'altra cartella viene rinominata;
//   - record assente dal CRM, record senza nome (la cartella sarebbe la radice
//     dell'archivio) o file assente negli zip → solo report.
// Idempotente e ripartibile: lo stato è Nextcloud stesso.
//
// Uso:
//   node --env-file=.env.local scripts/migrations/import-zoho-allegati.mjs \
//     --backup ~/migrazione-finale/zoho-backup [--since 2026-09-01] \
//     [--out <cartella>] [--concurrency 2] [--apply]
import { execFile } from "node:child_process"
import { closeSync, fstatSync, mkdirSync, openSync, readSync, readdirSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { inflateRawSync } from "node:zlib"
import { parse } from "csv-parse/sync"
import { createClient } from "@supabase/supabase-js"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        /* non e' un modulo TS: si prosegue con la risoluzione normale */
      }
    }
    return nextResolve(specifier, context)
  },
})

const { listFolder, moveFile, uploadFile } = await import("../../lib/nextcloud/admin-webdav.ts")
const { folderPathForRecord, nomeSenzaCollisioni, sanitizeName, splitEstensione } = await import(
  "../../lib/allegati/paths.ts"
)
const { provisionaCartellaRecord } = await import("../../lib/allegati/provisioning.ts")

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
  console.error(
    "Uso: import-zoho-allegati.mjs --backup <cartella> [--since AAAA-MM-GG] [--out <cartella>] [--concurrency N] [--apply]",
  )
  process.exit(1)
}
const since = argument("since") ?? "2026-09-01"
if (!/^\d{4}-\d{2}-\d{2}/.test(since)) throw new Error(`--since non valido: ${since}`)
const concurrency = Math.max(1, Number(argument("concurrency") ?? 2) || 2)
const backupDir = resolve(expandHome(backupArg))
const dataZip = join(backupDir, "Data_001.zip")
const outDir = resolve(
  expandHome(argument("out") ?? join(dirname(backupDir), "import-allegati-report")),
)

for (const name of ["NEXTCLOUD_URL", "NEXTCLOUD_ADMIN_USER", "NEXTCLOUD_ADMIN_PASSWORD"]) {
  if (!process.env[name]) throw new Error(`Variabile d'ambiente mancante: ${name}`)
}
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Utilità ────────────────────────────────────────────────────────────────

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function nullable(value) {
  const normalized = String(value ?? "").trim()
  return normalized || null
}

async function readBackupCsv(entry) {
  const { stdout } = await execFileAsync("unzip", ["-p", dataZip, entry], {
    encoding: "utf8",
    maxBuffer: 500 * 1024 * 1024,
  })
  return parse(stdout, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
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

const TENTATIVI = 4

async function conRetry(etichetta, fn) {
  let ultimoErrore = null
  for (let tentativo = 1; tentativo <= TENTATIVI; tentativo++) {
    try {
      return await fn()
    } catch (error) {
      ultimoErrore = error
      const status = error?.status ?? 0
      if (!(status === 0 || status === 429 || status >= 500) || tentativo === TENTATIVI) break
      console.error(`   retry ${etichetta}: tentativo ${tentativo}/${TENTATIVI} (${error.message})`)
      await new Promise((done) => setTimeout(done, 900 * tentativo))
    }
  }
  throw ultimoErrore
}

function davError(result, fallback) {
  const error = new Error(result.error ?? `${fallback} (HTTP ${result.status})`)
  error.status = result.status
  return error
}

// ─── Zip ────────────────────────────────────────────────────────────────────
// Lettore minimale della directory centrale: estrae una voce per offset, senza
// passare dai pattern di `unzip` (che trattano [ ] * ? come jolly) e senza
// caricare in memoria archivi da oltre 1 GB.

function readAt(fd, position, length) {
  const buffer = Buffer.alloc(length)
  let offset = 0
  while (offset < length) {
    const read = readSync(fd, buffer, offset, length - offset, position + offset)
    if (read === 0) break
    offset += read
  }
  return buffer
}

function zipEntries(zipPath) {
  const fd = openSync(zipPath, "r")
  try {
    const size = fstatSync(fd).size
    const tailLength = Math.min(size, 65557)
    const tail = readAt(fd, size - tailLength, tailLength)
    let eocd = -1
    for (let index = tail.length - 22; index >= 0; index--) {
      if (tail.readUInt32LE(index) === 0x06054b50) {
        eocd = index
        break
      }
    }
    if (eocd === -1) throw new Error(`${zipPath}: fine della directory centrale non trovata`)
    let cdSize = tail.readUInt32LE(eocd + 12)
    let cdOffset = tail.readUInt32LE(eocd + 16)
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) {
      const locator = eocd - 20
      if (locator < 0 || tail.readUInt32LE(locator) !== 0x07064b50) {
        throw new Error(`${zipPath}: zip64 senza locator`)
      }
      const zip64 = readAt(fd, Number(tail.readBigUInt64LE(locator + 8)), 56)
      cdSize = Number(zip64.readBigUInt64LE(40))
      cdOffset = Number(zip64.readBigUInt64LE(48))
    }

    const cd = readAt(fd, cdOffset, cdSize)
    const entries = []
    for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50; ) {
      const nameLength = cd.readUInt16LE(p + 28)
      const extraLength = cd.readUInt16LE(p + 30)
      const commentLength = cd.readUInt16LE(p + 32)
      const entry = {
        zipPath,
        method: cd.readUInt16LE(p + 10),
        compressedSize: cd.readUInt32LE(p + 20),
        size: cd.readUInt32LE(p + 24),
        localOffset: cd.readUInt32LE(p + 42),
        name: cd.toString("utf8", p + 46, p + 46 + nameLength),
      }
      // Campo extra zip64 (0x0001): contiene solo i valori saturati a 0xffffffff.
      let x = p + 46 + nameLength
      const extraEnd = x + extraLength
      while (x + 4 <= extraEnd) {
        const id = cd.readUInt16LE(x)
        const length = cd.readUInt16LE(x + 2)
        if (id === 0x0001) {
          let q = x + 4
          for (const key of ["size", "compressedSize", "localOffset"]) {
            if (entry[key] === 0xffffffff) {
              entry[key] = Number(cd.readBigUInt64LE(q))
              q += 8
            }
          }
        }
        x += 4 + length
      }
      entries.push(entry)
      p = extraEnd + commentLength
    }
    return entries
  } finally {
    closeSync(fd)
  }
}

function extractEntry(entry) {
  const fd = openSync(entry.zipPath, "r")
  try {
    const header = readAt(fd, entry.localOffset, 30)
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error(`header locale non valido: ${entry.name}`)
    const dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
    const raw = readAt(fd, dataStart, entry.compressedSize)
    let data
    if (entry.method === 0) data = raw
    else if (entry.method === 8) data = inflateRawSync(raw)
    else throw new Error(`compressione ${entry.method} non gestita: ${entry.name}`)
    if (data.length !== entry.size) {
      throw new Error(`dimensione estratta ${data.length} ≠ ${entry.size}: ${entry.name}`)
    }
    return data
  } finally {
    closeSync(fd)
  }
}

function codiceAllegato(value) {
  return String(value ?? "").replace(/^Attachments\//, "").split("_")[0]
}

// ─── Nextcloud ──────────────────────────────────────────────────────────────

// Tutti i file sotto la cartella (ricorsivo) + i nomi nella radice.
// exists=false se la cartella del record non c'è.
async function listaAlbero(folderPath) {
  const root = await conRetry(`list ${folderPath}`, async () => {
    const result = await listFolder(folderPath)
    if (!result.ok) throw davError(result, "PROPFIND fallita")
    return result
  })
  if (root.status === 404) return { exists: false, files: [], rootNames: [] }

  const files = []
  const rootNames = root.items.map((item) => item.nome)
  const queue = [root.items]
  while (queue.length > 0) {
    for (const item of queue.shift()) {
      if (!item.isFolder) {
        files.push({ nome: item.nome, byte: item.byte, path: item.path })
        continue
      }
      const sub = await conRetry(`list ${item.path}`, async () => {
        const result = await listFolder(item.path)
        if (!result.ok) throw davError(result, "PROPFIND fallita")
        return result
      })
      queue.push(sub.items)
    }
  }
  return { exists: true, files, rootNames }
}

// Cartelle dell'archivio con lo stesso nome scritto diversamente ("Rossi
// Mario" per "Mario Rossi", maiuscole, accenti, spazi attorno ai trattini):
// il CRM non le vede, ma creare la cartella esatta divide i documenti in due
// posti. Restituisce tutte le candidate: si rinomina solo se è una sola.
function chiaveNome(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(" ")
}

const archivi = new Map()
function cartellaSimile(cartella) {
  const base = cartella.split("/").slice(0, -1).join("/")
  if (!archivi.has(base)) {
    archivi.set(
      base,
      listFolder(base).then((result) => {
        const map = new Map()
        for (const item of result.ok ? result.items : []) {
          if (!item.isFolder) continue
          const chiave = chiaveNome(item.nome)
          if (!map.has(chiave)) map.set(chiave, [])
          map.get(chiave).push(item.path)
        }
        return map
      }),
    )
  }
  return archivi.get(base).then((map) => map.get(chiaveNome(cartella.split("/").pop())) ?? [])
}

function nomeZoho(nome) {
  const { base, estensione } = splitEstensione(nome)
  return `${base} (zoho)${estensione}`
}

function stessoNome(a, b) {
  return a.toLowerCase() === b.toLowerCase()
}

// ─── Dati ───────────────────────────────────────────────────────────────────

console.log(`Modalità: ${apply ? "APPLY (upload su Nextcloud)" : "dry-run (solo report, nessuna scrittura)"}`)
console.log(`Backup: ${backupDir} | since: ${since}`)

const [attachments, notes, emails] = await Promise.all([
  readBackupCsv("Data/Attachments_001.csv"),
  readBackupCsv("Data/Notes_001.csv"),
  readBackupCsv("Data/Emails_001.csv"),
])
const noteById = new Map(notes.map((row) => [normalizeZohoId(row["ID record"]), row]))
const emailById = new Map(emails.map((row) => [normalizeZohoId(row["ID record"]), row]))

const zipFiles = readdirSync(backupDir)
  .filter((name) => /^Attachments_\d+\.zip$/.test(name))
  .sort()
const zipIndex = new Map()
for (const name of zipFiles) {
  for (const entry of zipEntries(join(backupDir, name))) {
    if (!entry.name.endsWith("/")) zipIndex.set(codiceAllegato(entry.name), entry)
  }
}
console.log(`Zip allegati: ${zipFiles.length}, file indicizzati: ${zipIndex.size}`)

const inPerimetro = attachments.filter((row) => String(row["Ora creazione"] ?? "") >= since)
console.log(`Allegati nel backup: ${attachments.length}, dal ${since}: ${inPerimetro.length}`)

// Record Zoho a cui appartiene l'allegato, risalendo da nota/email.
function padre(row) {
  const modulo = nullable(row["Parent Id.Module"]) ?? "?"
  const parentId = normalizeZohoId(row["ID  principale.id"] ?? row["ID principale.id"])
  if (modulo === "Notes") {
    const nota = noteById.get(parentId)
    if (!nota) return { etichetta: "Notes→?", modulo: null, zohoId: parentId }
    const target = nullable(nota["Parent Id.Module"]) ?? "?"
    return { etichetta: `Notes→${target}`, modulo: target, zohoId: normalizeZohoId(nota["ID  principale.id"] ?? nota["ID principale.id"]) }
  }
  if (modulo === "Emails") {
    const email = emailById.get(parentId)
    if (!email) return { etichetta: "Emails→?", modulo: null, zohoId: parentId }
    const target = nullable(email.Modulo) ?? "?"
    return { etichetta: `Emails→${target}`, modulo: target, zohoId: normalizeZohoId(email["Nome record.id"]) }
  }
  return { etichetta: modulo, modulo, zohoId: parentId }
}

const TARGET = {
  Contacts: { tipo: "cliente", table: "clienti", key: "zoho_record_id", nome: "nome_clienti" },
  Leads: { tipo: "lead", table: "leads", key: "zoho_id", nome: "nome_lead" },
}

const piani = inPerimetro.map((row) => ({ row, ...padre(row) }))

const recordByModulo = {}
for (const [modulo, config] of Object.entries(TARGET)) {
  const ids = [...new Set(piani.filter((p) => p.modulo === modulo && p.zohoId).map((p) => p.zohoId))]
  const map = new Map()
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200)
    const { data, error } = await supabase
      .from(config.table)
      .select(`id,${config.key},${config.nome}`)
      .in(config.key, [...chunk, ...chunk.map((id) => `zcrm_${id}`)])
    if (error) throw new Error(`${config.table}: ${error.message}`)
    for (const record of data ?? []) {
      map.set(normalizeZohoId(record[config.key]), { id: record.id, nome: record[config.nome] ?? "" })
    }
  }
  recordByModulo[modulo] = map
  console.log(`${config.table}: ${map.size}/${ids.length} record trovati nel CRM`)
}

// ─── Piano ──────────────────────────────────────────────────────────────────

const report = []
const perCartella = new Map()

for (const piano of piani) {
  const { row } = piano
  const nomeFile = sanitizeName(nullable(row["Nome file"]) ?? "") || "allegato"
  const entry = zipIndex.get(codiceAllegato(row["ID record"]))
  const base = {
    modulo: piano.etichetta,
    zoho_allegato: row["ID record"],
    zoho_record: piano.zohoId,
    file: nomeFile,
    dimensione: entry?.size ?? nullable(row.Dimensione) ?? "",
  }
  const config = TARGET[piano.modulo]
  if (!config) {
    report.push({ ...base, azione: "modulo_non_gestito" })
    continue
  }
  const record = recordByModulo[piano.modulo].get(piano.zohoId)
  if (!record) {
    report.push({ ...base, azione: "record_non_trovato", record_tipo: config.tipo })
    continue
  }
  const recordInfo = { record_tipo: config.tipo, record: record.id, nome_record: record.nome }
  if (!sanitizeName(record.nome)) {
    report.push({ ...base, ...recordInfo, azione: "record_senza_nome" })
    continue
  }
  if (!entry) {
    report.push({ ...base, ...recordInfo, azione: "file_mancante_nel_backup" })
    continue
  }
  const cartella = folderPathForRecord(config.tipo, record.id, record.nome)
  if (!perCartella.has(cartella)) {
    perCartella.set(cartella, { cartella, tipo: config.tipo, record, recordInfo, modulo: piano.etichetta, files: [] })
  }
  perCartella.get(cartella).files.push({ base: { ...base, ...recordInfo, cartella }, entry, nomeFile })
}

// ─── Esecuzione per cartella ────────────────────────────────────────────────

async function esisteCartella(path) {
  const result = await conRetry(`list ${path}`, async () => {
    const listing = await listFolder(path)
    if (!listing.ok) throw davError(listing, "PROPFIND fallita")
    return listing
  })
  return result.status !== 404
}

// Prima passata: per ogni cartella mancante, cosa fare della cartella simile.
// Serve vedere tutti i gruppi insieme: una cartella simile rivendicata da due
// record non va assegnata a nessuno dei due.
async function pianificaCartelle(gruppi) {
  const mancanti = []
  let indice = 0
  async function worker() {
    while (indice < gruppi.length) {
      const gruppo = gruppi[indice++]
      if (await esisteCartella(gruppo.cartella)) {
        gruppo.cartellaAzione = "esistente"
        continue
      }
      gruppo.simili = await cartellaSimile(gruppo.cartella)
      mancanti.push(gruppo)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  const rivendicate = new Map()
  for (const gruppo of mancanti) {
    for (const path of gruppo.simili) rivendicate.set(path, (rivendicate.get(path) ?? 0) + 1)
  }

  // Cartelle simili che sono già la cartella esatta di un altro cliente.
  const nomiCandidati = [...new Set(mancanti.filter((g) => g.tipo === "cliente").flatMap((g) => g.simili))].map(
    (path) => path.split("/").pop(),
  )
  const cartelleDiClienti = new Set()
  for (let index = 0; index < nomiCandidati.length; index += 100) {
    const chunk = nomiCandidati.slice(index, index + 100)
    const { data, error } = await supabase
      .from("clienti")
      .select("id,nome_clienti")
      .in("nome_clienti", chunk)
    if (error) throw new Error(`clienti per nome: ${error.message}`)
    for (const cliente of data ?? []) {
      cartelleDiClienti.add(folderPathForRecord("cliente", cliente.id, cliente.nome_clienti ?? ""))
    }
  }

  for (const gruppo of mancanti) {
    const [simile] = gruppo.simili
    if (gruppo.simili.length === 0) gruppo.cartellaAzione = "cartella_creata"
    else if (gruppo.simili.length > 1) gruppo.cartellaAzione = "cartella_simile_multipla"
    else if (rivendicate.get(simile) > 1) gruppo.cartellaAzione = "cartella_simile_contesa"
    else if (cartelleDiClienti.has(simile)) gruppo.cartellaAzione = "cartella_di_altro_record"
    else gruppo.cartellaAzione = "rinominata"
  }
}

async function processaCartella(gruppo) {
  const simile = (gruppo.simili ?? []).join(" | ")
  const rigaCartella = {
    ...gruppo.recordInfo,
    azione: gruppo.cartellaAzione,
    modulo: gruppo.modulo,
    cartella: gruppo.cartella,
    cartella_simile: simile,
  }

  if (["cartella_simile_multipla", "cartella_simile_contesa", "cartella_di_altro_record"].includes(gruppo.cartellaAzione)) {
    report.push(rigaCartella)
    for (const file of gruppo.files) {
      report.push({ ...file.base, azione: gruppo.cartellaAzione, cartella_simile: simile })
    }
    return
  }

  let albero
  if (gruppo.cartellaAzione === "rinominata") {
    const [attuale] = gruppo.simili
    report.push({ ...rigaCartella, cartella_attuale: attuale, cartella_nuova: gruppo.cartella })
    if (apply) {
      // Ricontrollo subito prima del MOVE; moveFile usa comunque Overwrite: F.
      if (await esisteCartella(gruppo.cartella)) {
        throw new Error(`la cartella ${gruppo.cartella} esiste già: rinomina annullata`)
      }
      const moved = await moveFile(attuale, gruppo.cartella)
      if (!moved.ok) throw davError(moved, "rinomina cartella fallita")
      // Stessa struttura di una cartella nata dall'app (lead: Documenti obbligatori).
      const result = await provisionaCartellaRecord(gruppo.tipo, gruppo.record.id, gruppo.record.nome)
      if (!result.ok) throw davError(result, "provisioning cartella fallito")
      albero = await listaAlbero(gruppo.cartella)
    } else {
      // Dry-run: si valutano i file sulla cartella attuale, con i percorsi che avranno dopo.
      albero = await listaAlbero(attuale)
      albero.files = albero.files.map((item) => ({ ...item, path: gruppo.cartella + item.path.slice(attuale.length) }))
    }
  } else {
    albero = await listaAlbero(gruppo.cartella)
    if (!albero.exists) {
      report.push(rigaCartella)
      if (apply) {
        const result = await provisionaCartellaRecord(gruppo.tipo, gruppo.record.id, gruppo.record.nome)
        if (!result.ok) throw davError(result, "provisioning cartella fallito")
        if (result.path !== gruppo.cartella) {
          throw new Error(`provisioning su percorso inatteso: ${result.path} ≠ ${gruppo.cartella}`)
        }
      }
    }
  }

  for (const file of gruppo.files) {
    file.base.cartella_simile = simile
    const size = file.entry.size
    const candidati = [file.nomeFile, nomeZoho(file.nomeFile)]
    const presente = albero.files.find(
      (item) => item.byte === size && candidati.some((nome) => stessoNome(item.nome, nome)),
    )
    if (presente) {
      report.push({ ...file.base, azione: "skip_presente", presente: presente.path })
      continue
    }

    const omonimo = albero.files.some((item) => stessoNome(item.nome, file.nomeFile))
    const nome = omonimo ? nomeSenzaCollisioni(nomeZoho(file.nomeFile), albero.rootNames) : file.nomeFile
    // Difesa: il PUT sovrascrive, quindi il nome scelto non deve esistere in radice.
    if (albero.rootNames.some((esistente) => stessoNome(esistente, nome))) {
      throw new Error(`nome già presente in ${gruppo.cartella}: ${nome}`)
    }
    const azione = omonimo ? "upload_rinominato" : "upload"
    const fullPath = `${gruppo.cartella}/${nome}`

    if (apply) {
      try {
        const data = extractEntry(file.entry)
        await conRetry(`upload ${fullPath}`, async () => {
          const result = await uploadFile(fullPath, data)
          if (!result.ok) throw davError(result, "upload fallito")
          return result
        })
      } catch (error) {
        report.push({ ...file.base, azione: "errore", nome_nextcloud: nome, errore: error.message })
        continue
      }
    }
    report.push({ ...file.base, azione, nome_nextcloud: nome })
    albero.files.push({ nome, byte: size, path: fullPath })
    albero.rootNames.push(nome)
  }
}

const gruppi = [...perCartella.values()]
await pianificaCartelle(gruppi)
let prossimo = 0
let fatti = 0
async function worker() {
  while (prossimo < gruppi.length) {
    const gruppo = gruppi[prossimo++]
    try {
      await processaCartella(gruppo)
    } catch (error) {
      for (const file of gruppo.files) {
        if (!report.some((row) => row.zoho_allegato === file.base.zoho_allegato && row.cartella === gruppo.cartella)) {
          report.push({ ...file.base, azione: "errore", errore: error.message })
        }
      }
      console.error(`   errore cartella ${gruppo.cartella}: ${error.message}`)
    }
    fatti++
    if (fatti % 25 === 0) console.log(`   cartelle ${fatti}/${gruppi.length}`)
  }
}

try {
  await Promise.all(Array.from({ length: concurrency }, worker))
} finally {
  mkdirSync(outDir, { recursive: true })
  const reportPath = writeCsv(
    "allegati.csv",
    ["azione", "modulo", "record_tipo", "record", "nome_record", "cartella", "file", "nome_nextcloud", "dimensione", "zoho_allegato", "zoho_record", "presente", "cartella_attuale", "cartella_nuova", "cartella_simile", "errore"],
    report,
  )

  const AZIONI = ["upload", "upload_rinominato", "skip_presente", "cartella_creata", "rinominata", "cartella_simile_multipla", "cartella_simile_contesa", "cartella_di_altro_record", "record_non_trovato", "record_senza_nome", "file_mancante_nel_backup", "modulo_non_gestito", "errore"]
  // Righe allegato (hanno "file") e righe cartella contate separatamente.
  function riepilogo(titolo, righe) {
    const perModulo = new Map()
    for (const row of righe) {
      if (!perModulo.has(row.modulo)) perModulo.set(row.modulo, Object.fromEntries(AZIONI.map((a) => [a, 0])))
      perModulo.get(row.modulo)[row.azione] += 1
    }
    const totali = Object.fromEntries(AZIONI.map((a) => [a, 0]))
    for (const counts of perModulo.values()) for (const a of AZIONI) totali[a] += counts[a]
    const colonne = AZIONI.filter((a) => totali[a] > 0)
    const tabella = {}
    for (const [modulo, counts] of [...perModulo.entries(), ["TOTALE", totali]]) {
      tabella[modulo] = Object.fromEntries(colonne.map((a) => [a, counts[a]]))
    }
    console.log(`\n${titolo}:`)
    console.table(tabella)
  }
  riepilogo("Allegati per modulo e azione", report.filter((row) => row.file))
  riepilogo("Cartelle per modulo e azione", report.filter((row) => !row.file))
  const cartelle = report.filter((row) => !row.file && row.cartella_simile)
  if (cartelle.length > 0) {
    console.log(`\nCartelle simili (${cartelle.length}):`)
    for (const row of cartelle) {
      console.log(`  [${row.azione}] ${row.cartella_simile}  →  ${row.cartella}`)
    }
  }
  console.log(`Report: ${reportPath}`)
  if (!apply) console.log("Dry-run: nessuna cartella creata, nessun file caricato. Rilancia con --apply per scrivere.")
}
