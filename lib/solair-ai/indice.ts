import "server-only"

import { createClient } from "@/lib/supabase/server"
import { isEntitaAI } from "./tipi"
import type { EntitaAI } from "./tipi"

const MIN_TOKEN_LENGTH = 3

type ChunkRow = {
  id: string
  documento_id: string
  entita: EntitaAI
  path: string
  titolo: string
  contenuto: string
  keywords: string[]
}

export type SolairAiKnowledgeSnippet = {
  entita: EntitaAI
  path: string
  titolo: string
  contenuto: string
  score: number
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
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

function scoreChunk(queryTokens: string[], row: ChunkRow) {
  const haystack = normalize(`${row.titolo} ${row.path} ${row.contenuto.slice(0, 4000)}`)
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

export async function cercaIndiceSolairAI(
  query: string,
  options: { entita?: EntitaAI | null; limit?: number } = {},
): Promise<SolairAiKnowledgeSnippet[]> {
  const queryTokens = tokens(query).slice(0, 16)
  if (queryTokens.length === 0) return []

  const supabase = await createClient()
  let request = supabase
    .from("crm_ai_document_chunks")
    .select("id, documento_id, entita, path, titolo, contenuto, keywords")
    .overlaps("keywords", queryTokens)
    .limit(80)

  if (options.entita && isEntitaAI(options.entita)) {
    request = request.eq("entita", options.entita)
  }

  const { data, error } = await request
  if (error) return []

  const dedupe = new Map<string, SolairAiKnowledgeSnippet>()
  for (const row of (data ?? []) as ChunkRow[]) {
    const score = scoreChunk(queryTokens, row)
    if (score <= 0) continue
    const key = `${row.path}:${row.contenuto}`
    const snippet = {
      entita: row.entita,
      path: row.path,
      titolo: row.titolo,
      contenuto: row.contenuto,
      score,
    }
    const current = dedupe.get(key)
    if (!current || snippet.score > current.score) dedupe.set(key, snippet)
  }

  return [...dedupe.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 8)
}
