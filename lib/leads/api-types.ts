// Contratto API condiviso del modulo Lead (client <-> route handlers).
// Identico a quello che soddisferà una query SQL reale (Supabase) in futuro.
import type { Lead, LeadColumnId } from "@/lib/mock-data"
import {
  type AdvancedFilterState,
  EMPTY_ADVANCED,
} from "@/lib/leads/advanced-filter-logic"

export type ScoreFilter = "all" | "caldo" | "medio" | "freddo"
export type SortDir = "asc" | "desc"

// Riga "leggera" della lista: solo i campi proiettati (mai i campi pesanti
// come attivita[]/documenti[]). Tipata come Partial<Lead> con id garantito.
export type LeadListItem = Partial<Lead> & { id: string }

// Campi SEMPRE inclusi nella proiezione lista (usati dalla UI tabella:
// cella nome, riga espansa, badge). Esclude di proposito attivita/documenti.
export const LIST_BASE_FIELDS: LeadColumnId[] = [
  "Nome Lead",
  "E-mail",
  "Telefono",
  "campaign name",
  "Valutazione",
  "Descrizione",
  "leadCaldo",
  "possibileDuplicato",
  "Badge dell'attività",
  "Badge di nota",
] as unknown as LeadColumnId[]

export interface LeadListParams {
  page: number
  pageSize: number
  sortBy: LeadColumnId | null
  sortDir: SortDir
  search: string
  stato: string
  sede: string
  commerciale: string
  origine: string
  tag: string
  score: ScoreFilter
  onlyDuplicates: boolean
  advanced: AdvancedFilterState
  /** Colonne richieste oltre alla base; [] => solo base. "*" => tutte. */
  fields: string[]
}

export interface LeadListResponse {
  rows: LeadListItem[]
  total: number
  page: number
  pageSize: number
}

export interface LeadStats {
  total: number
  byStato: Record<string, number>
  caldi: number
  duplicati: number
  nonAssegnati: number
}

export const DEFAULT_LIST_PARAMS: LeadListParams = {
  page: 1,
  pageSize: 10,
  sortBy: "Valutazione",
  sortDir: "desc",
  search: "",
  stato: "all",
  sede: "all",
  commerciale: "all",
  origine: "all",
  tag: "all",
  score: "all",
  onlyDuplicates: false,
  advanced: EMPTY_ADVANCED,
  fields: [],
}

// --- Encode: params -> URLSearchParams (per fetch lato client) ---
export function buildLeadsSearchParams(p: LeadListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  if (p.stato !== "all") sp.set("stato", p.stato)
  if (p.sede !== "all") sp.set("sede", p.sede)
  if (p.commerciale !== "all") sp.set("commerciale", p.commerciale)
  if (p.origine !== "all") sp.set("origine", p.origine)
  if (p.tag !== "all") sp.set("tag", p.tag)
  if (p.score !== "all") sp.set("score", p.score)
  if (p.onlyDuplicates) sp.set("onlyDuplicates", "1")
  if (p.fields.length > 0) sp.set("fields", p.fields.join(","))
  // advanced solo se attivo (riduce la lunghezza dell'URL/chiave cache)
  const hasAdvanced =
    Object.values(p.advanced.quick).some(Boolean) ||
    Object.keys(p.advanced.fields).length > 0
  if (hasAdvanced) sp.set("advanced", JSON.stringify(p.advanced))
  return sp
}

// --- Decode: URLSearchParams -> params (lato server, route handler) ---
export function parseLeadsSearchParams(sp: URLSearchParams): LeadListParams {
  const scoreRaw = sp.get("score") as ScoreFilter | null
  let advanced = EMPTY_ADVANCED
  const adv = sp.get("advanced")
  if (adv) {
    try {
      advanced = JSON.parse(adv) as AdvancedFilterState
    } catch {
      advanced = EMPTY_ADVANCED
    }
  }
  const fieldsRaw = sp.get("fields")
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "10") || 10)),
    sortBy: (sp.get("sortBy") as LeadColumnId | null) ?? null,
    sortDir: sp.get("sortDir") === "asc" ? "asc" : "desc",
    search: sp.get("search") ?? "",
    stato: sp.get("stato") ?? "all",
    sede: sp.get("sede") ?? "all",
    commerciale: sp.get("commerciale") ?? "all",
    origine: sp.get("origine") ?? "all",
    tag: sp.get("tag") ?? "all",
    score: scoreRaw ?? "all",
    onlyDuplicates: sp.get("onlyDuplicates") === "1",
    advanced,
    fields: fieldsRaw ? fieldsRaw.split(",").filter(Boolean) : [],
  }
}
