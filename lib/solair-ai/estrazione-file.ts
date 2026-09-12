import "server-only"

import JSZip from "jszip"
import { createExtractorFromData, type FileHeader } from "node-unrar-js"

import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"

import { richiediMessaggioClaude } from "./anthropic"

export const MAX_FILE_INDEX_BYTES = 25 * 1024 * 1024

const DEFAULT_INGEST_MODEL = "claude-sonnet-5"
const MAX_ARCHIVE_DEPTH = 2
const MAX_ARCHIVE_ENTRIES = 250
const MAX_ARCHIVE_ENTRY_BYTES = 20 * 1024 * 1024
const MAX_ARCHIVE_TOTAL_BYTES = 120 * 1024 * 1024

const TEXT_FILE_EXTENSIONS = new Set([
  "csv",
  "eml",
  "htm",
  "html",
  "json",
  "log",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
])

const IMAGE_MEDIA_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
])

const WORD_OPEN_XML_EXTENSIONS = new Set(["docx", "docm", "dotx", "dotm"])
const EXCEL_OPEN_XML_EXTENSIONS = new Set(["xlsx", "xlsm", "xltx", "xltm"])
const POWERPOINT_OPEN_XML_EXTENSIONS = new Set(["pptx", "pptm", "potx", "potm", "ppsx", "ppsm"])
const OPENDOCUMENT_EXTENSIONS = new Set(["odt", "ods", "odp"])
const ZIP_ARCHIVE_EXTENSIONS = new Set(["zip"])
const RAR_ARCHIVE_EXTENSIONS = new Set(["rar", "cbr"])

export type StatoEstrazioneIndicizzabile = "ready" | "empty" | "unsupported"

export type EstrazioneIndicizzabile = {
  stato: StatoEstrazioneIndicizzabile
  testo: string
  mediaType: string
  errore: string | null
}

export function extensionOf(nome: string) {
  const match = nome.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ""
}

export function normalizeMediaType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() || null
}

export function mediaTypeFromName(nome: string) {
  const ext = extensionOf(nome)
  if (WORD_OPEN_XML_EXTENSIONS.has(ext)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  if (EXCEL_OPEN_XML_EXTENSIONS.has(ext)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
  if (POWERPOINT_OPEN_XML_EXTENSIONS.has(ext)) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }
  if (OPENDOCUMENT_EXTENSIONS.has(ext)) {
    return "application/vnd.oasis.opendocument.text"
  }

  switch (ext) {
    case "pdf":
      return "application/pdf"
    case "zip":
      return "application/zip"
    case "rar":
    case "cbr":
      return "application/vnd.rar"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    case "csv":
      return "text/csv"
    case "htm":
    case "html":
      return "text/html"
    case "json":
      return "application/json"
    case "md":
      return "text/markdown"
    case "rtf":
      return "application/rtf"
    case "txt":
      return "text/plain"
    case "xml":
      return "application/xml"
    case "yaml":
    case "yml":
      return "text/yaml"
    default:
      return "application/octet-stream"
  }
}

function mediaTypeFromBytes(buffer: Uint8Array) {
  const startsWith = (bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte)
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "application/pdf"
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return "application/zip"
  if (startsWith([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return "application/vnd.rar"
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return "image/png"
  if (startsWith([0x47, 0x49, 0x46])) return "image/gif"
  if (
    startsWith([0x52, 0x49, 0x46, 0x46]) &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp"
  }
  return null
}

function isTextFile(nome: string, mediaType: string) {
  return (
    mediaType.startsWith("text/") ||
    ["application/json", "application/xml"].includes(mediaType) ||
    TEXT_FILE_EXTENSIONS.has(extensionOf(nome))
  )
}

function rtfToText(value: string) {
  return value
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\tab/gi, " ")
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function canExtractWithClaude(mediaType: string) {
  return mediaType === "application/pdf" || IMAGE_MEDIA_TYPES.has(mediaType)
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function xmlToText(xml: string) {
  return decodeEntities(
    xml
      .replace(/<\/(?:w:p|a:p|row|si)>/g, "\n")
      .replace(/<\/(?:w:tc|c)>/g, " | ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\|\s+/g, " | ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function arrayBufferOf(buffer: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength)
  copy.set(buffer)
  return copy.buffer
}

function readableArchiveEntry(name: string) {
  const clean = name.replace(/\\/g, "/")
  if (!clean || clean.endsWith("/")) return false
  if (clean.includes("__MACOSX/") || clean.split("/").some((part) => part.startsWith("."))) {
    return false
  }
  return true
}

function zipEntrySize(entry: JSZip.JSZipObject) {
  const maybe = entry as unknown as { _data?: { uncompressedSize?: number } }
  const size = maybe._data?.uncompressedSize
  return typeof size === "number" && Number.isFinite(size) ? size : null
}

async function zipText(zip: JSZip, names: string[]) {
  const parts: string[] = []
  for (const name of names) {
    const file = zip.file(name)
    if (!file) continue
    const text = xmlToText(await file.async("text"))
    if (text) parts.push(text)
  }
  return parts.join("\n\n").trim()
}

async function extractDocx(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer)
  const names = Object.keys(zip.files)
    .filter((name) =>
      /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/i.test(name),
    )
    .sort()
  return zipText(zip, names)
}

async function extractPptx(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer)
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "it", { numeric: true }))
  return zipText(zip, names)
}

async function extractXlsx(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer)
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("text")
  const shared = (sharedXml?.match(/<si[\s\S]*?<\/si>/g) ?? []).map(xmlToText)
  const sheets = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, "it", { numeric: true }))

  const output: string[] = []
  for (const sheet of sheets) {
    const xml = await zip.file(sheet)?.async("text")
    if (!xml) continue
    const rows = xml.match(/<row[\s\S]*?<\/row>/g) ?? []
    const lines = rows
      .map((row) => {
        const cells = row.match(/<c[\s\S]*?<\/c>/g) ?? []
        return cells
          .map((cell) => {
            const type = cell.match(/\st="([^"]+)"/)?.[1]
            if (type === "inlineStr") {
              return xmlToText(cell.match(/<is[\s\S]*?<\/is>/)?.[0] ?? "")
            }
            const raw = cell.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]?.trim() ?? ""
            if (type === "s") return shared[Number(raw)] ?? raw
            return decodeEntities(raw)
          })
          .filter(Boolean)
          .join(" | ")
      })
      .filter(Boolean)
    if (lines.length > 0) output.push(`${sheet}\n${lines.join("\n")}`)
  }

  return output.join("\n\n").trim()
}

async function extractOpenDocument(buffer: Uint8Array) {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file("content.xml")?.async("text")
  return xml ? xmlToText(xml) : ""
}

async function extractWithClaude(params: {
  nome: string
  mediaType: string
  base64: string
}) {
  const apiKey = process.env.SOLAIR_AI_API_KEY
  if (!apiKey || !canExtractWithClaude(params.mediaType)) return null

  const sourceBlock =
    params.mediaType === "application/pdf"
      ? {
          type: "document",
          title: params.nome,
          source: { type: "base64", media_type: params.mediaType, data: params.base64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: params.mediaType, data: params.base64 },
        }

  const model = process.env.SOLAIR_AI_INGEST_MODEL?.trim() || DEFAULT_INGEST_MODEL
  const esito = await richiediMessaggioClaude({
    apiKey,
    etichetta: `estrazione ${params.nome}`,
    corpo: {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            sourceBlock,
            {
              type: "text",
              text:
                "Estrai in italiano tutto il testo e tutte le informazioni utili per rispondere a domande interne sul documento. Mantieni nomi, date, importi, codici, riferimenti e tabelle in forma compatta. Non inventare nulla.",
            },
          ],
        },
      ],
    },
  })

  const body = esito.corpo
  if (!esito.ok) {
    const message =
      typeof body === "object" &&
      body != null &&
      "error" in body &&
      typeof (body as { error?: { message?: unknown } }).error?.message === "string"
        ? (body as { error: { message: string } }).error.message
        : `HTTP ${esito.status}`
    throw new Error(`Anthropic ${params.nome}: ${message}`)
  }

  if (typeof body !== "object" || body == null || !("content" in body)) return null
  const content = (body as { content?: unknown }).content
  if (!Array.isArray(content)) return null

  return content
    .map((block) =>
      typeof block === "object" &&
      block != null &&
      "type" in block &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text
        : "",
    )
    .join("\n")
    .trim()
}

async function extractZipArchive(params: {
  nome: string
  path: string
  buffer: Uint8Array
  depth: number
  usaClaude: boolean
}) {
  if (params.depth >= MAX_ARCHIVE_DEPTH) {
    return {
      testo: "",
      errore: "Archivio annidato oltre il limite di sicurezza",
    }
  }

  const zip = await JSZip.loadAsync(params.buffer)
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && readableArchiveEntry(entry.name))
  const parts: string[] = []
  const warnings: string[] = []
  let total = 0

  for (const entry of entries.slice(0, MAX_ARCHIVE_ENTRIES)) {
    const size = zipEntrySize(entry)
    if (size != null && size > MAX_ARCHIVE_ENTRY_BYTES) {
      warnings.push(`${entry.name}: file interno troppo grande`)
      continue
    }
    const innerBuffer = await entry.async("uint8array")
    total += innerBuffer.byteLength
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      warnings.push("archivio interrotto: limite totale di sicurezza raggiunto")
      break
    }
    const inner = await estraiContenutoDaBuffer({
      nome: entry.name.split("/").pop() ?? entry.name,
      path: `${params.path}!/${entry.name}`,
      buffer: innerBuffer,
      contentType: null,
      depth: params.depth + 1,
      usaClaude: params.usaClaude,
    })
    if (inner.testo) parts.push(`--- File interno: ${entry.name} ---\n${inner.testo}`)
    else if (inner.errore) warnings.push(`${entry.name}: ${inner.errore}`)
  }

  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    warnings.push(`letti i primi ${MAX_ARCHIVE_ENTRIES} file interni su ${entries.length}`)
  }

  return { testo: parts.join("\n\n").trim(), errore: warnings.join("; ") || null }
}

async function extractRarArchive(params: {
  nome: string
  path: string
  buffer: Uint8Array
  depth: number
  usaClaude: boolean
}) {
  if (params.depth >= MAX_ARCHIVE_DEPTH) {
    return {
      testo: "",
      errore: "Archivio annidato oltre il limite di sicurezza",
    }
  }

  const extractor = await createExtractorFromData({ data: arrayBufferOf(params.buffer) })
  const list = extractor.getFileList()
  const headers = [...list.fileHeaders]
  if (list.arcHeader.flags.volume) {
    return { testo: "", errore: "Archivio RAR multi-volume non supportato" }
  }

  const allowedNames = new Set(
    headers
      .filter((header) => !header.flags.directory && readableArchiveEntry(header.name))
      .filter((header) => {
        if (header.flags.encrypted) return false
        return header.unpSize <= MAX_ARCHIVE_ENTRY_BYTES
      })
      .slice(0, MAX_ARCHIVE_ENTRIES)
      .map((header) => header.name),
  )

  const encrypted = headers.filter((header) => header.flags.encrypted).length
  const oversized = headers.filter((header) => header.unpSize > MAX_ARCHIVE_ENTRY_BYTES).length
  const warnings: string[] = []
  if (encrypted > 0) warnings.push(`${encrypted} file interni protetti da password`)
  if (oversized > 0) warnings.push(`${oversized} file interni troppo grandi`)
  if (headers.length > MAX_ARCHIVE_ENTRIES) {
    warnings.push(`letti i primi ${MAX_ARCHIVE_ENTRIES} file interni su ${headers.length}`)
  }

  const extracted = extractor.extract({
    files: (header: FileHeader) => allowedNames.has(header.name),
  })

  const parts: string[] = []
  let total = 0
  for (const entry of extracted.files) {
    if (!entry.extraction || entry.fileHeader.flags.directory) continue
    total += entry.extraction.byteLength
    if (total > MAX_ARCHIVE_TOTAL_BYTES) {
      warnings.push("archivio interrotto: limite totale di sicurezza raggiunto")
      break
    }
    const inner = await estraiContenutoDaBuffer({
      nome: entry.fileHeader.name.split("/").pop() ?? entry.fileHeader.name,
      path: `${params.path}!/${entry.fileHeader.name}`,
      buffer: entry.extraction,
      contentType: null,
      depth: params.depth + 1,
      usaClaude: params.usaClaude,
    })
    if (inner.testo) parts.push(`--- File interno: ${entry.fileHeader.name} ---\n${inner.testo}`)
    else if (inner.errore) warnings.push(`${entry.fileHeader.name}: ${inner.errore}`)
  }

  return { testo: parts.join("\n\n").trim(), errore: warnings.join("; ") || null }
}

/**
 * Ripulisce il testo estratto da cio' che Postgres non sa memorizzare.
 *
 * Il byte NUL e i surrogati spaiati non sono rari nei PDF e negli xlsx reali,
 * e arrivavano fino alla INSERT: "unsupported Unicode escape sequence", file
 * perso. Non e' un problema del parallelo — si vedeva anche prima — ma su
 * 25.000 file diventa una fetta che vale la pena non buttare.
 */
export function ripuliTestoPerDatabase(testo: string): string {
  return testo
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
}

export async function estraiContenutoDaBuffer(params: {
  nome: string
  path: string
  buffer: Uint8Array
  contentType: string | null
  depth?: number
  usaClaude?: boolean
}): Promise<EstrazioneIndicizzabile> {
  const depth = params.depth ?? 0
  const usaClaude = params.usaClaude ?? true
  const ext = extensionOf(params.nome)
  const mediaType =
    (WORD_OPEN_XML_EXTENSIONS.has(ext) ||
    EXCEL_OPEN_XML_EXTENSIONS.has(ext) ||
    POWERPOINT_OPEN_XML_EXTENSIONS.has(ext) ||
    OPENDOCUMENT_EXTENSIONS.has(ext) ||
    ZIP_ARCHIVE_EXTENSIONS.has(ext) ||
    RAR_ARCHIVE_EXTENSIONS.has(ext)
      ? mediaTypeFromName(params.nome)
      : null) ??
    mediaTypeFromBytes(params.buffer) ??
    normalizeMediaType(params.contentType) ??
    mediaTypeFromName(params.nome)

  if (WORD_OPEN_XML_EXTENSIONS.has(ext)) {
    const testo = await extractDocx(params.buffer)
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (EXCEL_OPEN_XML_EXTENSIONS.has(ext)) {
    const testo = await extractXlsx(params.buffer)
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (POWERPOINT_OPEN_XML_EXTENSIONS.has(ext)) {
    const testo = await extractPptx(params.buffer)
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (OPENDOCUMENT_EXTENSIONS.has(ext)) {
    const testo = await extractOpenDocument(params.buffer)
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (ZIP_ARCHIVE_EXTENSIONS.has(ext)) {
    const archivio = await extractZipArchive({
      nome: params.nome,
      path: params.path,
      buffer: params.buffer,
      depth,
      usaClaude,
    })
    return {
      stato: archivio.testo ? "ready" : "empty",
      testo: archivio.testo,
      mediaType,
      errore: archivio.errore,
    }
  }

  if (RAR_ARCHIVE_EXTENSIONS.has(ext)) {
    const archivio = await extractRarArchive({
      nome: params.nome,
      path: params.path,
      buffer: params.buffer,
      depth,
      usaClaude,
    })
    return {
      stato: archivio.testo ? "ready" : "empty",
      testo: archivio.testo,
      mediaType,
      errore: archivio.errore,
    }
  }

  if (mediaType === "application/pdf") {
    const testo = await estraiTestoDaPdf(params.buffer)
    if (testo) return { stato: "ready", testo, mediaType, errore: null }
  }

  if (isTextFile(params.nome, mediaType)) {
    const testo = new TextDecoder("utf-8", { fatal: false }).decode(params.buffer).trim()
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (ext === "rtf" || mediaType === "application/rtf") {
    const testo = rtfToText(new TextDecoder("utf-8", { fatal: false }).decode(params.buffer))
    return { stato: testo ? "ready" : "empty", testo, mediaType, errore: null }
  }

  if (usaClaude && canExtractWithClaude(mediaType)) {
    const testo = await extractWithClaude({
      nome: params.nome,
      mediaType,
      base64: Buffer.from(params.buffer).toString("base64"),
    })
    return { stato: testo ? "ready" : "empty", testo: testo ?? "", mediaType, errore: null }
  }

  if (canExtractWithClaude(mediaType)) {
    return {
      stato: "empty",
      testo: "",
      mediaType,
      errore: "Contenuto non estratto automaticamente senza OCR/Claude",
    }
  }

  return {
    stato: "unsupported",
    testo: "",
    mediaType,
    errore: `Formato file non supportato per lettura contenuto (${mediaType})`,
  }
}
