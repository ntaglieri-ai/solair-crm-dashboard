import type { Compito, StatoCompito } from "@/lib/mock-data"
import type { CompitoSortKey } from "@/components/compiti/compito-table"

export type SortDir = "asc" | "desc"

// Riga lista: compatibile con Compito — campi non in DB ricevono default.
export type CompitiListItem = Compito

export interface CompitiListParams {
  page: number
  pageSize: number
  sortBy: CompitoSortKey | null
  sortDir: SortDir
  search: string
  /** Array degli stati selezionati; [] = nessun filtro. */
  stati: StatoCompito[]
  priorita: string
  proprietario: string
  sede: string
  scadenzaDa: string
  scadenzaA: string
  /** Solo compiti scaduti (scadenza < adesso, stato ≠ Completato) — coerente con il KPI. */
  overdue: boolean
}

export interface CompitiListResponse {
  rows: CompitiListItem[]
  /** Totale assoluto dei compiti, indipendente dai filtri della vista. */
  absoluteTotal: number
  total: number
  page: number
  pageSize: number
  /** Compiti scaduti nella query corrente (non paginati). */
  scadutiTotal: number
  /** KPI assoluti, indipendenti dai filtri della vista. */
  overdueTotal: number
  highPriorityTotal: number
  openTotal: number
}

export const INITIAL_PAGE_SIZE = 50

export const DEFAULT_COMPITI_PARAMS: CompitiListParams = {
  page: 1,
  pageSize: INITIAL_PAGE_SIZE,
  sortBy: "Data di scadenza",
  sortDir: "asc",
  search: "",
  stati: [],
  priorita: "all",
  proprietario: "all",
  sede: "all",
  scadenzaDa: "",
  scadenzaA: "",
  overdue: false,
}

export function buildCompitiSearchParams(p: CompitiListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  if (p.stati.length > 0) sp.set("stati", p.stati.join(","))
  if (p.priorita !== "all") sp.set("priorita", p.priorita)
  if (p.proprietario !== "all") sp.set("proprietario", p.proprietario)
  if (p.sede !== "all") sp.set("sede", p.sede)
  if (p.scadenzaDa) sp.set("scadenzaDa", p.scadenzaDa)
  if (p.scadenzaA) sp.set("scadenzaA", p.scadenzaA)
  if (p.overdue) sp.set("overdue", "true")
  return sp
}

export function parseCompitiSearchParams(sp: URLSearchParams): CompitiListParams {
  const statiRaw = sp.get("stati")
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as CompitoSortKey | null) ?? null,
    sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
    search: sp.get("search") ?? "",
    stati: statiRaw ? (statiRaw.split(",").filter(Boolean) as StatoCompito[]) : [],
    priorita: sp.get("priorita") ?? "all",
    proprietario: sp.get("proprietario") ?? "all",
    sede: sp.get("sede") ?? "all",
    scadenzaDa: sp.get("scadenzaDa") ?? "",
    scadenzaA: sp.get("scadenzaA") ?? "",
    overdue: sp.get("overdue") === "true",
  }
}
