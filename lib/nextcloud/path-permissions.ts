// Regole di visibilita' per-path sui documenti Nextcloud.
// DB-backed e modificabili a runtime (tabella permessi_cartelle_nextcloud):
// vince il prefisso con `priorita` piu' bassa fra quelli che matchano, poi si
// guarda l'accesso del ruolo. Applicata SEMPRE server-side prima di restituire
// listing o link al client — mai solo in UI.
//
// Nota gap (owner-scoping): le regole "owner del cliente OPPURE Director+"
// restano enforced al tier Director+ perche' non esiste ancora un mapping
// path -> cliente lato server. L'owner-scoping fine e' documentato come TODO.

import { createClient } from "@/lib/supabase/server"
import type { RoleCode } from "@/lib/permissions/types"
// Ciclo di import con provisioning.ts (che importa computeRequiredGroupShares):
// benigno, entrambi i lati si usano solo dentro funzioni, mai in valutazione
// di modulo.
import { nextcloudGroupForRole } from "./provisioning"

export type NcAccess = "hidden" | "readonly" | "editable"

// Regola normalizzata per l'enforcement: `allowed` contiene i codici ruolo
// (uppercase) con accesso != hidden (readonly/editable = cartella visibile).
export type NcPathRule = {
  prefix: string
  priorita: number
  allowed: Set<string>
  // Accesso per ruolo sul prefisso (solo readonly/editable, mai hidden): serve
  // a derivare i permessi della condivisione Nextcloud in
  // computeRequiredGroupShares(). `allowed` resta la fonte per l'enforcement.
  accessByRole: Map<string, Exclude<NcAccess, "hidden">>
}

/** Regola con lo stesso accesso per tutti i ruoli elencati. */
function uniformRule(
  prefix: string,
  priorita: number,
  roles: string[],
  accesso: Exclude<NcAccess, "hidden"> = "editable",
): NcPathRule {
  return {
    prefix,
    priorita,
    allowed: new Set(roles),
    accessByRole: new Map(roles.map((role) => [role, accesso])),
  }
}

type NcPathRuleRow = {
  path_prefix: string
  ruolo_id: string
  accesso: NcAccess | null
  priorita: number | null
}

type RuoloRow = { id: string; code: string | null; nome: string | null }

const DIRECTOR_PLUS = ["DIRECTOR", "ADMIN", "SUPERADMIN"]
const ADMIN_PLUS = ["ADMIN", "SUPERADMIN"]
const ALL_ROLES = ["SUPERADMIN", "ADMIN", "DIRECTOR", "STANDARD", "AGENT"]
const EXPLICIT_RULE_ROLES = new Set(["AGENT"])
const TEAM_FOLDER_ROOT = "Solair"

// Fallback identico all'array hardcoded storico, usato SOLO se la tabella DB
// non e' ancora disponibile (migration non applicata / errore di lettura): cosi'
// il comportamento resta byte-identico anche prima del seed, senza mai aprire
// per sbaglio cartelle ristrette.
const FALLBACK_RULES: NcPathRule[] = [
  uniformRule("Vendita-Digitale/Clienti 2.0/", 10, DIRECTOR_PLUS),
  uniformRule("My-Space/Apps/Zoho CRM/Clienti/", 20, DIRECTOR_PLUS),
  uniformRule("Vendita-Digitale/Finanziaria/", 30, DIRECTOR_PLUS),
  uniformRule("Solair-Agenti/Finanziaria", 40, DIRECTOR_PLUS),
  uniformRule("Solair-Agenti/FINANZIAMENTI", 50, DIRECTOR_PLUS),
  uniformRule("Solair-Ufficio/VIOLA/Firme E Timbri/", 60, ADMIN_PLUS),
  uniformRule("Solair-Ufficio/Old", 70, DIRECTOR_PLUS),
  uniformRule("Vendita-Digitale/Old", 80, DIRECTOR_PLUS),
  // Cat 4 — Materiale commerciale (tutti i ruoli). Prefissi FIX 18/07: i nomi nudi
  // ("LISTINI", "Schede tecniche", ecc.) non matchavano mai via startsWith perche'
  // sul filesystem reale queste cartelle sono annidate sotto Solair-Agenti/,
  // Solair-Ufficio/ e Vendita-Digitale/, mai a root. Elencata una riga per ogni
  // posizione reale (verificata via `rclone lsd --max-depth 2`); il casing di
  // "Schede tecniche"/"Schede Tecniche" e' quello reale su disco (match case-sensitive).
  uniformRule("Solair-Agenti/LISTINI", 90, ALL_ROLES),
  uniformRule("Vendita-Digitale/LISTINI", 91, ALL_ROLES),
  uniformRule("Solair-Agenti/Schede tecniche", 100, ALL_ROLES),
  uniformRule("Vendita-Digitale/Schede tecniche", 101, ALL_ROLES),
  uniformRule("Solair-Ufficio/Schede Tecniche", 102, ALL_ROLES),
  uniformRule("Vendita-Digitale/INSERZIONI ATTIVE", 110, ALL_ROLES),
  uniformRule("Solair-Agenti/Sponsorizzate", 120, ALL_ROLES),
  uniformRule("Solair-Ufficio/Sponsorizzate", 121, ALL_ROLES),
]

// Cache in-memory con lo STESSO pattern di load-permissions (TTL da
// PERMISSION_CACHE_MS + invalidazione esplicita on-write): le regole sono
// globali, quindi un solo slot di cache. La route di salvataggio chiama
// invalidateNcPathRulesCache() dopo ogni modifica.
const ncPathRulesCacheMs = Number(
  process.env.PERMISSION_CACHE_MS ?? (process.env.NODE_ENV === "development" ? 30_000 : 60_000),
)

let cachedRules: { expiresAt: number; rules: NcPathRule[] } | null = null

export function invalidateNcPathRulesCache() {
  cachedRules = null
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  )
}

/** Ordina le regole per priorita' crescente; a parita', prefisso piu' lungo prima. */
function sortRules(rules: NcPathRule[]): NcPathRule[] {
  return rules.sort((a, b) => a.priorita - b.priorita || b.prefix.length - a.prefix.length)
}

/**
 * Carica le regole path dalla tabella permessi_cartelle_nextcloud (cache TTL).
 * Se la tabella non e' disponibile ricade sulle FALLBACK_RULES storiche.
 */
export async function loadNcPathRules(): Promise<NcPathRule[]> {
  if (cachedRules && cachedRules.expiresAt > Date.now()) return cachedRules.rules

  const supabase = await createClient()
  const [rulesRes, ruoliRes] = await Promise.all([
    supabase
      .from("permessi_cartelle_nextcloud")
      .select("path_prefix, ruolo_id, accesso, priorita"),
    supabase.from("ruoli").select("id, code, nome"),
  ])

  if (rulesRes.error) {
    if (!isMissingTableError(rulesRes.error)) {
      console.warn("[nextcloud] lettura regole path fallita:", rulesRes.error.message)
    }
    return FALLBACK_RULES
  }

  const roleCodeById = new Map<string, string>()
  for (const r of (ruoliRes.data ?? []) as RuoloRow[]) {
    roleCodeById.set(r.id, (r.code ?? r.nome ?? "").toUpperCase())
  }

  // Raggruppa per prefisso: una regola per prefisso con l'insieme dei ruoli
  // (uppercase) che hanno accesso != hidden.
  const byPrefix = new Map<string, NcPathRule>()
  for (const row of (rulesRes.data ?? []) as NcPathRuleRow[]) {
    const rule =
      byPrefix.get(row.path_prefix) ??
      {
        prefix: row.path_prefix,
        priorita: row.priorita ?? 100,
        allowed: new Set<string>(),
        accessByRole: new Map<string, Exclude<NcAccess, "hidden">>(),
      }
    // La priorita' e' definita a livello di prefisso: tieni la piu' bassa vista.
    rule.priorita = Math.min(rule.priorita, row.priorita ?? 100)
    const code = roleCodeById.get(row.ruolo_id)
    if (code && row.accesso && row.accesso !== "hidden") {
      rule.allowed.add(code)
      rule.accessByRole.set(code, row.accesso)
    }
    byPrefix.set(row.path_prefix, rule)
  }

  const rules = sortRules([...byPrefix.values()])
  cachedRules = { expiresAt: Date.now() + ncPathRulesCacheMs, rules }
  return rules
}

// Permessi OCS della condivisione: 1 = sola lettura, 31 = RWCD
// (lettura+scrittura+creazione+cancellazione+ricondivisione).
const NC_SHARE_PERMISSIONS: Record<Exclude<NcAccess, "hidden">, number> = {
  readonly: 1,
  editable: 31,
}

export type NcGroupShare = { folder: string; group: string; permissions: number }

export function ncPhysicalSharePath(prefix: string): string {
  const normalized = normalizeNcPath(prefix).replace(/\/+$/, "")
  if (!normalized || normalized === TEAM_FOLDER_ROOT || normalized.startsWith(`${TEAM_FOLDER_ROOT}/`)) {
    return normalized
  }
  return `${TEAM_FOLDER_ROOT}/${normalized}`
}

/**
 * Condivisioni Nextcloud necessarie perche' le regole della tabella valgano
 * anche come accesso fisico reale. Si condivide il percorso ESATTO della
 * regola, non la sua radice: l'ereditarieta' Nextcloud propaga solo verso il
 * basso, quindi condividere la radice darebbe accesso anche ai sottopercorsi
 * che la tabella restringe a ruoli superiori (es. Finanziaria dentro
 * Vendita-Digitale). Il contenuto futuro dentro il percorso condiviso resta
 * comunque coperto dall'ereditarieta'.
 *
 * La condivisione e' per GRUPPO: applicarla una volta copre ogni account con
 * quel ruolo, presente e futuro.
 */
export async function computeRequiredGroupShares(): Promise<NcGroupShare[]> {
  const rules = await loadNcPathRules()
  const byKey = new Map<string, NcGroupShare>()

  for (const rule of rules) {
    const folder = ncPhysicalSharePath(rule.prefix)
    if (!folder) continue
    for (const [roleCode, accesso] of rule.accessByRole) {
      const group = nextcloudGroupForRole(roleCode)
      if (!group) continue
      const permissions = NC_SHARE_PERMISSIONS[accesso]
      const key = `${folder} -> ${group}`
      const prev = byKey.get(key)
      // Stesso percorso e stesso gruppo da regole diverse: vince il permesso
      // piu' ampio, cosi' una riga readonly non declassa una editable.
      if (!prev || permissions > prev.permissions) byKey.set(key, { folder, group, permissions })
    }
  }

  return [...byKey.values()]
}

/** Normalizza un path: rimuove slash iniziali e sequenze doppie. */
export function normalizeNcPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/{2,}/g, "/")
}

function rulePath(path: string): string {
  const normalized = normalizeNcPath(path).replace(/\/+$/, "")
  if (normalized === TEAM_FOLDER_ROOT) return ""
  return normalized.startsWith(`${TEAM_FOLDER_ROOT}/`) ? normalized.slice(`${TEAM_FOLDER_ROOT}/`.length) : normalized
}

export function roleRequiresExplicitNcPathRule(roleCode: RoleCode): boolean {
  return EXPLICIT_RULE_ROLES.has((roleCode ?? "").toUpperCase())
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  const normalized = rulePath(path)
  const normalizedPrefix = rulePath(prefix)
  return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`)
}

function ruleAllowsRole(rule: NcPathRule, roleCode: RoleCode): boolean {
  return rule.allowed.has((roleCode ?? "").toUpperCase())
}

/**
 * Il ruolo puo' accedere al path? Vince la prima regola (per priorita') che
 * matcha. Se nessuna regola matcha, AGENT resta chiuso per default; gli altri
 * ruoli mantengono il comportamento storico permissivo. `rules` va caricato
 * con loadNcPathRules() dal chiamante (async) e riusato per l'intero listing.
 */
export function canAccessNcPath(path: string, roleCode: RoleCode, rules: NcPathRule[]): boolean {
  const normalized = rulePath(path)
  if (!normalized) return true

  for (const rule of rules) {
    if (pathMatchesPrefix(normalized, rule.prefix)) {
      return ruleAllowsRole(rule, roleCode)
    }
  }
  return !roleRequiresExplicitNcPathRule(roleCode)
}

/**
 * Il path e' navigabile nell'albero? Per i ruoli in allowlist esplicita (oggi
 * AGENT) un parent senza accesso diretto puo' restare visibile solo se serve a
 * raggiungere almeno un prefisso consentito, es. Vendita-Digitale -> LISTINI.
 */
export function canBrowseNcTreePath(path: string, roleCode: RoleCode, rules: NcPathRule[]): boolean {
  const normalized = rulePath(path)
  if (!normalized || canAccessNcPath(normalized, roleCode, rules)) return true
  if (!roleRequiresExplicitNcPathRule(roleCode)) return true

  for (const rule of rules) {
    const prefix = rulePath(rule.prefix)
    if (ruleAllowsRole(rule, roleCode) && prefix.startsWith(`${normalized}/`)) {
      return true
    }
  }
  return false
}

/** Filtra una lista di entry (con .path) tenendo solo quelle accessibili. */
export function filterNcEntriesByRole<T extends { path: string }>(
  entries: T[],
  roleCode: RoleCode,
  rules: NcPathRule[],
): T[] {
  return entries.filter((e) => canAccessNcPath(e.path, roleCode, rules))
}
