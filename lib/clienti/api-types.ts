import type { ClienteRecord, ClienteColumnId } from "@/lib/mock-data"
import { DEFAULT_CLIENTE_COLUMNS } from "@/lib/mock-data"
import {
  appendFilterValues,
  parseFilterValues,
} from "@/lib/shared/filter-values"

export type SortDir = "asc" | "desc"

// Riga lista: compatibile con ClienteRecord — campi non in DB default a undefined/[].
export type ClientiListItem = ClienteRecord

export interface ClientiListParams {
  page: number
  pageSize: number
  sortBy: ClienteColumnId | null
  sortDir: SortDir
  search: string
  stato: string[]
  sede: string[]
  proprietario: string[]
  installatore: string[]
  // Report Vito (3): esisteva l'infrastruttura tag (tabella, badge,
  // gestione) ma nessun modo di filtrare la lista per tag — mancava
  // interamente da qui in giu', tendina UI disabilitata inclusa.
  tag: string[]
  /** Colonne richieste oltre alla base; [] => default visibili. "*" => tutte. */
  fields: string[]
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
  stato: [],
  sede: [],
  proprietario: [],
  installatore: [],
  tag: [],
  fields: [],
}

export function buildClientiSearchParams(p: ClientiListParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  appendFilterValues(sp, "stato", p.stato)
  appendFilterValues(sp, "sede", p.sede)
  appendFilterValues(sp, "proprietario", p.proprietario)
  appendFilterValues(sp, "installatore", p.installatore)
  appendFilterValues(sp, "tag", p.tag)
  if (p.fields.length > 0) sp.set("fields", p.fields.join(","))
  return sp
}

export function parseClientiSearchParams(sp: URLSearchParams): ClientiListParams {
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as ClienteColumnId | null) ?? null,
    sortDir: sp.get("sortDir") === "asc" ? "asc" : "desc",
    search: sp.get("search") ?? "",
    stato: parseFilterValues(sp, "stato"),
    sede: parseFilterValues(sp, "sede"),
    proprietario: parseFilterValues(sp, "proprietario"),
    installatore: parseFilterValues(sp, "installatore"),
    tag: parseFilterValues(sp, "tag"),
    fields: sp.get("fields")?.split(",").filter(Boolean) ??
      (DEFAULT_CLIENTE_COLUMNS as unknown as string[]),
  }
}
