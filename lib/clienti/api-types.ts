import type { ClienteRecord, ClienteColumnId } from "@/lib/mock-data"

export type SortDir = "asc" | "desc"

// Riga lista: compatibile con ClienteRecord — campi non in DB default a undefined/[].
export type ClientiListItem = ClienteRecord

export interface ClientiListParams {
  page: number
  pageSize: number
  sortBy: ClienteColumnId | null
  sortDir: SortDir
  search: string
  stato: string
  sede: string
  proprietario: string
  installatore: string
}

export interface ClientiListResponse {
  rows: ClientiListItem[]
  total: number
  page: number
  pageSize: number
}

export const INITIAL_PAGE_SIZE = 50

export const DEFAULT_CLIENTI_PARAMS: ClientiListParams = {
  page: 1,
  pageSize: INITIAL_PAGE_SIZE,
  sortBy: "Ora modifica",
  sortDir: "desc",
  search: "",
  stato: "all",
  sede: "all",
  proprietario: "all",
  installatore: "all",
}

export function buildClientiSearchParams(p: ClientiListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  if (p.stato !== "all") sp.set("stato", p.stato)
  if (p.sede !== "all") sp.set("sede", p.sede)
  if (p.proprietario !== "all") sp.set("proprietario", p.proprietario)
  if (p.installatore !== "all") sp.set("installatore", p.installatore)
  return sp
}

export function parseClientiSearchParams(sp: URLSearchParams): ClientiListParams {
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as ClienteColumnId | null) ?? null,
    sortDir: sp.get("sortDir") === "asc" ? "asc" : "desc",
    search: sp.get("search") ?? "",
    stato: sp.get("stato") ?? "all",
    sede: sp.get("sede") ?? "all",
    proprietario: sp.get("proprietario") ?? "all",
    installatore: sp.get("installatore") ?? "all",
  }
}
