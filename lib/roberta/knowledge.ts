import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { downloadFile, listFolder, type WebDavItem } from "@/lib/nextcloud/admin-webdav"
import { estraiTestoDaPdf } from "@/lib/listino/pdf-testo"

export type ListinoDocumento = {
  nome: string
  cartella: string
  categoria?: RobertaSourceCategory
  testo?: string
  contenuto_base64?: string
}

export type RobertaSourceCategory =
  | "listini"
  | "componenti"
  | "offerte"
  | "prezzi"
  | "finanziarie"
  | "varie"

export type RobertaKnowledgeSourceConfig = {
  id: string
  label: string
  categoria: RobertaSourceCategory
  path: string
  active: boolean
}

export type RobertaSyncResult = {
  sources: number
  updated: number
  reused: number
  chunks: number
  catalogItems: number
  scansPending: number
  errors: string[]
}

type KnowledgeSourceRow = {
  source_key: string
  fingerprint: string
}

type ChunkInsert = {
  source_key: string
  chunk_index: number
  categoria: string
  titolo: string
  contenuto: string
  keywords: string[]
  aggiornato_at: string
}

type CatalogInsert = {
  source_key: string
  categoria: string
  nome: string
  descrizione: string
  prezzo: number | null
  potenza_kw: number | null
  accumulo_kwh: number | null
  metadata: Record<string, unknown>
  aggiornato_at: string
}

type ExtractedDocumentCacheRow = {
  path: string
  fingerprint: string
  testo_estratto: string | null
}

export type RobertaKnowledgeResult = {
  query: string
  chunks: {
    source: string
    categoria: string
    titolo: string
    contenuto: string
    score: number
  }[]
  catalogo: {
    source: string
    categoria: string
    nome: string
    descrizione: string
    prezzo: number | null
    potenza_kw: number | null
    accumulo_kwh: number | null
    score: number
  }[]
}

const DEFAULT_INGEST_MODEL = "claude-sonnet-5"
const MAX_CHUNK_CHARS = 1800
const MIN_TOKEN_LENGTH = 3

export const ROBERTA_SOURCE_CATEGORIES: {
  value: RobertaSourceCategory
  label: string
}[] = [
  { value: "listini", label: "Listini" },
  { value: "componenti", label: "Componenti" },
  { value: "offerte", label: "Offerte" },
  { value: "prezzi", label: "Prezzi" },
  { value: "finanziarie", label: "Finanziarie" },
  { value: "varie", label: "Varie ed eventuali" },
]

export const DEFAULT_ROBERTA_SOURCES: RobertaKnowledgeSourceConfig[] = [
  {
    id: "vendita-digitale-listini",
    label: "Vendita Digitale - Listini",
    categoria: "listini",
    path: "Solair/Vendita-Digitale/LISTINI",
    active: true,
  },
  {
    id: "agenti-listini",
    label: "Agenti - Listini",
    categoria: "listini",
    path: "Solair/Solair-Agenti/LISTINI",
    active: true,
  },
]

const CATEGORY_RULES: { categoria: string; terms: string[] }[] = [
  { categoria: "fotovoltaico_accumulo", terms: ["fotovoltaico", "kwp", "accumulo", "kwh", "inverter"] },
  { categoria: "batterie", terms: ["batteria", "batterie", "storage", "accumulo", "solax", "byd", "v-tac", "sineng"] },
  { categoria: "pannelli", terms: ["pannello", "pannelli", "modulo", "moduli", "trina", "longi", "astronergy"] },
  { categoria: "finanziarie", terms: ["finanziaria", "finanziamento", "rata", "tan", "taeg", "credito"] },
  { categoria: "tariffe", terms: ["tariffa", "tariffe", "cer", "comunita energetica", "energia", "gse"] },
  { categoria: "offerte", terms: ["offerta", "premium", "smart one", "power plus", "prezzo", "iva"] },
  { categoria: "accessori", terms: ["accessorio", "accessori", "wallbox", "colonnina", "monitoraggio"] },
]

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function sourceKey(documento: ListinoDocumento) {
  return `${documento.cartella}/${documento.nome}`.replace(/\/{2,}/g, "/")
}

function fingerprint(documento: ListinoDocumento) {
  return createHash("sha256")
    .update(documento.nome)
    .update("\n")
    .update(documento.cartella)
    .update("\n")
    .update(documento.testo ?? "")
    .update("\n")
    .update(documento.contenuto_base64 ?? "")
    .digest("hex")
}

function isPdf(nome: string) {
  return nome.toLowerCase().endsWith(".pdf")
}

function fingerprintDi(item: WebDavItem) {
  if (item.etag) return `etag:${item.etag}`
  return `size-mtime:${item.dimensioneKb ?? "?"}-${item.modificato ?? "?"}`
}

async function extractPdfContent(path: string) {
  const result = await downloadFile(path)
  if (!result.ok || !result.body) {
    throw new Error(result.error ?? `Download fallito (${result.status})`)
  }

  const buffer = new Uint8Array(await new Response(result.body).arrayBuffer())
  const testo = await estraiTestoDaPdf(buffer)
  if (testo) return { testo, contenuto_base64: undefined }
  return { testo: "", contenuto_base64: Buffer.from(buffer).toString("base64") }
}

export async function fetchRobertaConfiguredDocuments(
  supabase: SupabaseClient,
  sources: RobertaKnowledgeSourceConfig[],
): Promise<ListinoDocumento[]> {
  const activeSources = sources.filter((source) => source.active)
  const filesBySource = await Promise.all(
    activeSources.map(async (source) => {
      const listing = await listFolder(source.path)
      if (!listing.ok) {
        throw new Error(
          `${source.label}: ${listing.error ?? `lettura fallita (${listing.status})`}`,
        )
      }
      return listing.items
        .filter((item) => !item.isFolder && isPdf(item.nome))
        .map((item) => ({
          source,
          item,
          fingerprint: fingerprintDi(item),
        }))
    }),
  )
  const files = filesBySource.flat()
  if (files.length === 0) return []

  const { data: cacheRows } = await supabase
    .from("listino_cache")
    .select("path, fingerprint, testo_estratto")
    .in(
      "path",
      files.map((file) => file.item.path),
    )
  const cache = new Map(
    ((cacheRows as ExtractedDocumentCacheRow[] | null) ?? []).map((row) => [
      row.path,
      row,
    ]),
  )
  const now = new Date().toISOString()
  const cacheUpserts: {
    path: string
    nome: string
    cartella: string
    fingerprint: string
    testo_estratto: string | null
    aggiornato_at: string
  }[] = []

  const documenti = await Promise.all(
    files.map(async ({ source, item, fingerprint: itemFingerprint }) => {
      const cached = cache.get(item.path)
      if (cached?.fingerprint === itemFingerprint && cached.testo_estratto) {
        return {
          nome: item.nome,
          cartella: source.label,
          categoria: source.categoria,
          testo: cached.testo_estratto,
        } satisfies ListinoDocumento
      }

      const extracted = await extractPdfContent(item.path)
      cacheUpserts.push({
        path: item.path,
        nome: item.nome,
        cartella: source.label,
        fingerprint: itemFingerprint,
        testo_estratto: extracted.testo || null,
        aggiornato_at: now,
      })
      return {
        nome: item.nome,
        cartella: source.label,
        categoria: source.categoria,
        testo: extracted.testo,
        contenuto_base64: extracted.contenuto_base64,
      } satisfies ListinoDocumento
    }),
  )

  if (cacheUpserts.length > 0) {
    await supabase.from("listino_cache").upsert(cacheUpserts, { onConflict: "path" })
  }

  return documenti
}

function categoriaPer(documento: ListinoDocumento, testo: string) {
  if (documento.categoria) return documento.categoria

  const haystack = normalize(`${documento.nome} ${documento.cartella} ${testo.slice(0, 4000)}`)
  let best = { categoria: "generale", score: 0 }

  for (const rule of CATEGORY_RULES) {
    const score = rule.terms.reduce(
      (total, term) => total + (haystack.includes(normalize(term)) ? 1 : 0),
      0,
    )
    if (score > best.score) best = { categoria: rule.categoria, score }
  }

  return best.categoria
}

function tokens(value: string) {
  return Array.from(
    new Set(
      normalize(value)
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= MIN_TOKEN_LENGTH),
    ),
  )
}

function chunkText(testo: string) {
  const righe = testo
    .split(/\n{2,}|\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ""

  for (const riga of righe) {
    const next = current ? `${current}\n${riga}` : riga
    if (next.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current)
      current = riga
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function parseItalianNumber(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseKw(line: string) {
  const match = line.match(/(\d{1,2}(?:[,.]\d{1,2})?)\s*kW[p]?/i)
  return match ? parseItalianNumber(match[1]) : null
}

function parseKwh(line: string) {
  const match = line.match(/(\d{1,2}(?:[,.]\d{1,2})?)\s*kWh/i)
  return match ? parseItalianNumber(match[1]) : null
}

function parsePrice(line: string) {
  const match = line.match(/(?:€\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:€|euro)/i)
  return match ? parseItalianNumber(match[1]) : null
}

function catalogItems(documento: ListinoDocumento, testo: string, categoria: string): CatalogInsert[] {
  const now = new Date().toISOString()
  const key = sourceKey(documento)
  const lines = testo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  return lines
    .map((line) => ({ line, prezzo: parsePrice(line) }))
    .filter((item) => item.prezzo != null)
    .slice(0, 80)
    .map(({ line, prezzo }, index) => ({
      source_key: key,
      categoria,
      nome: line.slice(0, 120),
      descrizione: line,
      prezzo,
      potenza_kw: parseKw(line),
      accumulo_kwh: parseKwh(line),
      metadata: { documento: documento.nome, cartella: documento.cartella, line_index: index },
      aggiornato_at: now,
    }))
}

async function extractScanWithClaude(documento: ListinoDocumento) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !documento.contenuto_base64) return null

  const model = process.env.ROBERTA_INGEST_MODEL?.trim() || DEFAULT_INGEST_MODEL
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: documento.contenuto_base64,
              },
              title: documento.nome,
            },
            {
              type: "text",
              text:
                "Estrai in italiano tutte le informazioni commerciali utili per un chatbot Solair: prezzi, prodotti, potenze, accumuli, garanzie, condizioni, note e tabelle. Mantieni righe compatte e fedeli, senza inventare.",
            },
          ],
        },
      ],
    }),
  })

  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body != null &&
      "error" in body &&
      typeof (body as { error?: { message?: unknown } }).error?.message === "string"
        ? (body as { error: { message: string } }).error.message
        : `HTTP ${response.status}`
    throw new Error(`Anthropic ${documento.nome}: ${message}`)
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

export async function fetchListinoDocuments(baseUrl: string): Promise<ListinoDocumento[]> {
  const key = process.env.LISTINO_READ_KEY
  if (!key) throw new Error("LISTINO_READ_KEY non configurata")

  const response = await fetch(new URL("/api/public/listino", baseUrl), {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  })
  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const message =
      typeof body === "object" && body != null && "error" in body
        ? String((body as { error?: unknown }).error)
        : `HTTP ${response.status}`
    throw new Error(`Listino non disponibile: ${message}`)
  }

  if (
    typeof body !== "object" ||
    body == null ||
    !("documenti" in body) ||
    !Array.isArray((body as { documenti?: unknown }).documenti)
  ) {
    throw new Error("Risposta listino non valida")
  }

  return (body as { documenti: ListinoDocumento[] }).documenti
}

export async function syncRobertaKnowledge(
  supabase: SupabaseClient,
  documenti: ListinoDocumento[],
  options: { force?: boolean } = {},
): Promise<RobertaSyncResult> {
  const result: RobertaSyncResult = {
    sources: documenti.length,
    updated: 0,
    reused: 0,
    chunks: 0,
    catalogItems: 0,
    scansPending: 0,
    errors: [],
  }

  const keys = documenti.map(sourceKey)
  const { data: existingRows } = keys.length
    ? await supabase
        .from("roberta_knowledge_sources")
        .select("source_key, fingerprint")
        .in("source_key", keys)
    : { data: [] }
  const existing = new Map(
    ((existingRows as KnowledgeSourceRow[] | null) ?? []).map((row) => [
      row.source_key,
      row.fingerprint,
    ]),
  )

  for (const documento of documenti) {
    const key = sourceKey(documento)
    const fp = fingerprint(documento)
    const now = new Date().toISOString()

    if (!options.force && existing.get(key) === fp) {
      result.reused++
      continue
    }

    let testo = (documento.testo ?? "").trim()
    let stato: "ready" | "scan_pending" | "empty" | "error" = testo ? "ready" : "empty"
    let errore: string | null = null

    if (!testo && documento.contenuto_base64) {
      try {
        testo = (await extractScanWithClaude(documento)) ?? ""
        stato = testo ? "ready" : "scan_pending"
      } catch (error) {
        stato = "scan_pending"
        errore = error instanceof Error ? error.message : "Errore lettura scansione"
        result.errors.push(errore)
      }
    }

    if (!testo && stato === "empty") result.scansPending++
    if (!testo && stato === "scan_pending") result.scansPending++

    const categoria = categoriaPer(documento, testo)

    await supabase.from("roberta_knowledge_sources").upsert(
      {
        source_key: key,
        nome: documento.nome,
        cartella: documento.cartella,
        fingerprint: fp,
        stato,
        testo_chars: testo.length,
        errore,
        synced_at: now,
      },
      { onConflict: "source_key" },
    )

    await supabase.from("roberta_knowledge_chunks").delete().eq("source_key", key)
    await supabase.from("roberta_catalog_items").delete().eq("source_key", key)

    const chunks: ChunkInsert[] = chunkText(testo).map((contenuto, index) => ({
      source_key: key,
      chunk_index: index,
      categoria,
      titolo: `${documento.nome} #${index + 1}`,
      contenuto,
      keywords: tokens(`${documento.nome} ${documento.cartella} ${categoria} ${contenuto}`).slice(0, 80),
      aggiornato_at: now,
    }))
    const items = catalogItems(documento, testo, categoria)

    if (chunks.length > 0) {
      const { error } = await supabase.from("roberta_knowledge_chunks").insert(chunks)
      if (error) result.errors.push(`chunks ${documento.nome}: ${error.message}`)
    }
    if (items.length > 0) {
      const { error } = await supabase.from("roberta_catalog_items").insert(items)
      if (error) result.errors.push(`catalogo ${documento.nome}: ${error.message}`)
    }

    result.updated++
    result.chunks += chunks.length
    result.catalogItems += items.length
  }

  if (keys.length > 0) {
    await supabase.from("roberta_knowledge_sources").delete().not("source_key", "in", `(${keys.map((key) => `"${key.replace(/"/g, '\\"')}"`).join(",")})`)
  }

  return result
}

function scoreText(queryTokens: string[], value: string, keywords: string[] = []) {
  const haystack = normalize(`${value} ${keywords.join(" ")}`)
  return queryTokens.reduce((score, token) => {
    if (haystack.includes(token)) return score + (keywords.includes(token) ? 4 : 1)
    return score
  }, 0)
}

export async function searchRobertaKnowledge(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<RobertaKnowledgeResult> {
  const queryTokens = tokens(query).slice(0, 20)

  const [{ data: chunksData }, { data: catalogData }] = await Promise.all([
    supabase
      .from("roberta_knowledge_chunks")
      .select("source_key, categoria, titolo, contenuto, keywords")
      .limit(600),
    supabase
      .from("roberta_catalog_items")
      .select("source_key, categoria, nome, descrizione, prezzo, potenza_kw, accumulo_kwh")
      .limit(300),
  ])

  const chunks = ((chunksData as {
    source_key: string
    categoria: string
    titolo: string
    contenuto: string
    keywords: string[]
  }[] | null) ?? [])
    .map((row) => ({
      source: row.source_key,
      categoria: row.categoria,
      titolo: row.titolo,
      contenuto: row.contenuto,
      score: queryTokens.length ? scoreText(queryTokens, `${row.titolo}\n${row.contenuto}`, row.keywords) : 1,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  const catalogo = ((catalogData as {
    source_key: string
    categoria: string
    nome: string
    descrizione: string
    prezzo: number | null
    potenza_kw: number | null
    accumulo_kwh: number | null
  }[] | null) ?? [])
    .map((row) => ({
      source: row.source_key,
      categoria: row.categoria,
      nome: row.nome,
      descrizione: row.descrizione,
      prezzo: row.prezzo,
      potenza_kw: row.potenza_kw,
      accumulo_kwh: row.accumulo_kwh,
      score: queryTokens.length ? scoreText(queryTokens, `${row.nome}\n${row.descrizione}`) : 1,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(3, Math.floor(limit / 2)))

  return { query, chunks, catalogo }
}
