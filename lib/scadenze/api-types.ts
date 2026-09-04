import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import {
  appendFilterValues,
  parseFilterValues,
} from "@/lib/shared/filter-values"

export type SortDir = "asc" | "desc"

export type ScadenzaSortKey = "nome" | "data_scadenza" | "proprietario_nome" | "updated_at"

export interface ScadenzeListParams {
  page: number
  pageSize: number
  sortBy: ScadenzaSortKey | null
  sortDir: SortDir
  /** Ricerca su Nome Scadenze. */
  search: string
  /** id utenti selezionati. [] = tutti. */
  proprietario: string[]
  /** Tag selezionati. [] = tutti. */
  tag: string[]
  scadenzaDa: string
  scadenzaA: string
  /** Valori selezionati tra "si" e "no". [] = tutti. */
  collegamento: Array<"si" | "no">
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
  proprietario: [],
  tag: [],
  scadenzaDa: "",
  scadenzaA: "",
  collegamento: [],
}

export function buildScadenzeSearchParams(p: ScadenzeListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  appendFilterValues(sp, "proprietario", p.proprietario)
  appendFilterValues(sp, "tag", p.tag)
  if (p.scadenzaDa) sp.set("scadenzaDa", p.scadenzaDa)
  if (p.scadenzaA) sp.set("scadenzaA", p.scadenzaA)
  appendFilterValues(sp, "collegamento", p.collegamento)
  return sp
}

export function parseScadenzeSearchParams(sp: URLSearchParams): ScadenzeListParams {
  const collegamento = parseFilterValues(sp, "collegamento").filter(
    (value): value is "si" | "no" => value === "si" || value === "no",
  )
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as ScadenzaSortKey | null) ?? null,
    sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
    search: sp.get("search") ?? "",
    proprietario: parseFilterValues(sp, "proprietario"),
    tag: parseFilterValues(sp, "tag"),
    scadenzaDa: sp.get("scadenzaDa") ?? "",
    scadenzaA: sp.get("scadenzaA") ?? "",
    collegamento,
  }
}
