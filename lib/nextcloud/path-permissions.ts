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

export type NcAccess = "hidden" | "readonly" | "editable"

// Regola normalizzata per l'enforcement: `allowed` contiene i codici ruolo
// (uppercase) con accesso != hidden (readonly/editable = cartella visibile).
export type NcPathRule = {
  prefix: string
  priorita: number
  allowed: Set<string>
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

// Fallback identico all'array hardcoded storico, usato SOLO se la tabella DB
// non e' ancora disponibile (migration non applicata / errore di lettura): cosi'
// il comportamento resta byte-identico anche prima del seed, senza mai aprire
// per sbaglio cartelle ristrette.
const FALLBACK_RULES: NcPathRule[] = [
  { prefix: "Vendita-Digitale/Clienti 2.0/", priorita: 10, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "My-Space/Apps/Zoho CRM/Clienti/", priorita: 20, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "Vendita-Digitale/Finanziaria/", priorita: 30, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "Solair-Agenti/Finanziaria", priorita: 40, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "Solair-Agenti/FINANZIAMENTI", priorita: 50, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "Solair-Ufficio/VIOLA/Firme E Timbri/", priorita: 60, allowed: new Set(ADMIN_PLUS) },
  { prefix: "Solair-Ufficio/Old", priorita: 70, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "Vendita-Digitale/Old", priorita: 80, allowed: new Set(DIRECTOR_PLUS) },
  { prefix: "LISTINI", priorita: 90, allowed: new Set(ALL_ROLES) },
  { prefix: "Schede tecniche", priorita: 100, allowed: new Set(ALL_ROLES) },
  { prefix: "INSERZIONI ATTIVE", priorita: 110, allowed: new Set(ALL_ROLES) },
  { prefix: "Sponsorizzate", priorita: 120, allowed: new Set(ALL_ROLES) },
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
      { prefix: row.path_prefix, priorita: row.priorita ?? 100, allowed: new Set<string>() }
    // La priorita' e' definita a livello di prefisso: tieni la piu' bassa vista.
    rule.priorita = Math.min(rule.priorita, row.priorita ?? 100)
    const code = roleCodeById.get(row.ruolo_id)
    if (code && row.accesso && row.accesso !== "hidden") rule.allowed.add(code)
    byPrefix.set(row.path_prefix, rule)
  }

  const rules = sortRules([...byPrefix.values()])
  cachedRules = { expiresAt: Date.now() + ncPathRulesCacheMs, rules }
  return rules
}

/** Normalizza un path: rimuove slash iniziali e sequenze doppie. */
export function normalizeNcPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/{2,}/g, "/")
}

/**
 * Il ruolo puo' accedere al path? Vince la prima regola (per priorita') che
 * matcha; se nessuna regola matcha il default e' "visibile a tutti" (i prefissi
 * ristretti sono enumerati esplicitamente). `rules` va caricato con
 * loadNcPathRules() dal chiamante (async) e riusato per l'intero listing.
 */
export function canAccessNcPath(path: string, roleCode: RoleCode, rules: NcPathRule[]): boolean {
  const normalized = normalizeNcPath(path)
  const rc = (roleCode ?? "").toUpperCase()
  for (const rule of rules) {
    if (normalized.startsWith(rule.prefix)) {
      return rule.allowed.has(rc)
    }
  }
  return true
}

/** Filtra una lista di entry (con .path) tenendo solo quelle accessibili. */
export function filterNcEntriesByRole<T extends { path: string }>(
  entries: T[],
  roleCode: RoleCode,
  rules: NcPathRule[],
): T[] {
  return entries.filter((e) => canAccessNcPath(e.path, roleCode, rules))
}
