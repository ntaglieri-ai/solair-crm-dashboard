import type { ScadenzaRecord } from "@/lib/scadenze/repository"

export type SortDir = "asc" | "desc"

export type ScadenzaSortKey = "nome" | "data_scadenza" | "proprietario_nome" | "updated_at"

export interface ScadenzeListParams {
  page: number
  pageSize: number
  sortBy: ScadenzaSortKey | null
  sortDir: SortDir
  /** Ricerca su Nome Scadenze. */
  search: string
  /** id utente (o "all"). */
  proprietario: string
  /** Valore tag esatto (o "all"). */
  tag: string
  scadenzaDa: string
  scadenzaA: string
  /** "all" | "si" (ha connesso_a_id) | "no" (nessun collegamento). */
  collegamento: "all" | "si" | "no"
}

export interface ScadenzeListResponse {
  rows: ScadenzaRecord[]
  total: number
  page: number
  pageSize: number
  /** Totale assoluto, indipendente dai filtri della vista. */
  absoluteTotal: number
  /** Scadute (data_scadenza < adesso), indipendente dai filtri della vista. */
  scaduteTotal: number
  /** In scadenza nei prossimi 7 giorni, indipendente dai filtri della vista. */
  prossimi7Total: number
}

export const INITIAL_PAGE_SIZE = 50

export const DEFAULT_SCADENZE_PARAMS: ScadenzeListParams = {
  page: 1,
  pageSize: INITIAL_PAGE_SIZE,
  sortBy: "data_scadenza",
  sortDir: "asc",
  search: "",
  proprietario: "all",
  tag: "all",
  scadenzaDa: "",
  scadenzaA: "",
  collegamento: "all",
}

export function buildScadenzeSearchParams(p: ScadenzeListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  if (p.proprietario !== "all") sp.set("proprietario", p.proprietario)
  if (p.tag !== "all") sp.set("tag", p.tag)
  if (p.scadenzaDa) sp.set("scadenzaDa", p.scadenzaDa)
  if (p.scadenzaA) sp.set("scadenzaA", p.scadenzaA)
  if (p.collegamento !== "all") sp.set("collegamento", p.collegamento)
  return sp
}

export function parseScadenzeSearchParams(sp: URLSearchParams): ScadenzeListParams {
  const collegamento = sp.get("collegamento")
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as ScadenzaSortKey | null) ?? null,
    sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
    search: sp.get("search") ?? "",
    proprietario: sp.get("proprietario") ?? "all",
    tag: sp.get("tag") ?? "all",
    scadenzaDa: sp.get("scadenzaDa") ?? "",
    scadenzaA: sp.get("scadenzaA") ?? "",
    collegamento: collegamento === "si" || collegamento === "no" ? collegamento : "all",
  }
}
