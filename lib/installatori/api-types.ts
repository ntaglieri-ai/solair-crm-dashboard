import type { InstallatoreRecord } from "@/lib/installatori/repository"

export type SortDir = "asc" | "desc"

/**
 * Canale su cui l'installatore riceve la scheda sopralluogo (spec 3.4).
 * Vive qui e non in repository.ts perche' serve anche ai form client, che non
 * possono importare valori da un modulo che tira dentro il client Supabase
 * server-side.
 */
export type CanalePreferito = "email" | "whatsapp"

/** Stesso default della colonna installatori.canale_preferito. */
export const CANALE_PREFERITO_DEFAULT: CanalePreferito = "email"

export const CANALE_PREFERITO_LABELS: Record<CanalePreferito, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
}

/**
 * Riporta al default un valore non riconosciuto invece di lanciare: la check
 * constraint a DB gia' impedisce valori fuori lista, questa e' solo la rete di
 * sicurezza per righe lette prima della migration o payload API malformati.
 */
export function normalizeCanalePreferito(value: unknown): CanalePreferito {
  return value === "whatsapp" || value === "email" ? value : CANALE_PREFERITO_DEFAULT
}

export type InstallatoreSortKey = "nome" | "email" | "updated_at"

export interface InstallatoriListParams {
  page: number
  pageSize: number
  sortBy: InstallatoreSortKey | null
  sortDir: SortDir
  /** Ricerca su Nome Installatore ed E-mail. */
  search: string
  /** id utente (o "all"). */
  proprietario: string
  /** Valore tag esatto (o "all"). */
  tag: string
  /** "all" | "attivo" | "non_attivo". */
  stato: "all" | "attivo" | "non_attivo"
}

export interface InstallatoriListResponse {
  rows: InstallatoreRecord[]
  total: number
  page: number
  pageSize: number
  /** Totale assoluto, indipendente dai filtri della vista. */
  absoluteTotal: number
  attiviTotal: number
  nonAttiviTotal: number
}

export const INITIAL_PAGE_SIZE = 50

export const DEFAULT_INSTALLATORI_PARAMS: InstallatoriListParams = {
  page: 1,
  pageSize: INITIAL_PAGE_SIZE,
  sortBy: "nome",
  sortDir: "asc",
  search: "",
  proprietario: "all",
  tag: "all",
  stato: "all",
}

export function buildInstallatoriSearchParams(
  p: InstallatoriListParams,
): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("page", String(p.page))
  sp.set("pageSize", String(p.pageSize))
  if (p.sortBy) sp.set("sortBy", p.sortBy)
  sp.set("sortDir", p.sortDir)
  if (p.search.trim()) sp.set("search", p.search.trim())
  if (p.proprietario !== "all") sp.set("proprietario", p.proprietario)
  if (p.tag !== "all") sp.set("tag", p.tag)
  if (p.stato !== "all") sp.set("stato", p.stato)
  return sp
}

export function parseInstallatoriSearchParams(
  sp: URLSearchParams,
): InstallatoriListParams {
  const stato = sp.get("stato")
  return {
    page: Math.max(1, Number(sp.get("page") ?? "1") || 1),
    pageSize: Math.min(200, Math.max(1, Number(sp.get("pageSize") ?? "50") || 50)),
    sortBy: (sp.get("sortBy") as InstallatoreSortKey | null) ?? null,
    sortDir: sp.get("sortDir") === "desc" ? "desc" : "asc",
    search: sp.get("search") ?? "",
    proprietario: sp.get("proprietario") ?? "all",
    tag: sp.get("tag") ?? "all",
    stato: stato === "attivo" || stato === "non_attivo" ? stato : "all",
  }
}
