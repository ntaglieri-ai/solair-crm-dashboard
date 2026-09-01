import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { buildDefaultPermissionSnapshot, normalizeRoleCode } from "./constants"
import type { DataScope, FieldAccess, PageAccess, PermissionSnapshot } from "./types"

type UtenteRow = {
  id: string
  auth_user_id: string | null
  nome: string | null
  email: string | null
  ruolo: string | null
  ruolo_id: string | null
  sede: string | null
  attivo: boolean | null
}

type RuoloRow = {
  id: string
  code: string | null
  nome: string | null
}

type AuthIdentity = {
  id: string
  email: string | null
}

type PermessoPaginaRow = {
  pagina: string
  accesso: PageAccess | boolean | null
}

type PermessoRecordRow = {
  modulo: string
  azione: string
  abilitato: boolean | null
}

type PermessoUiRow = {
  chiave: string
  abilitato: boolean | null
}

type PermessoAzioneRow = {
  azione: string
  abilitato: boolean | null
}

type PermessoCampoRow = {
  modulo: string
  campo: string
  accesso: FieldAccess | null
}

type PermessoScopeRow = {
  risorsa: string
  scope: DataScope | null
}

const unavailableOptionalTables = new Set<string>()
const rolePermissionCacheMs = Number(
  process.env.PERMISSION_CACHE_MS ?? (process.env.NODE_ENV === "development" ? 30_000 : 60_000),
)
const permissionRowColumns = "id, auth_user_id, nome, email, ruolo, ruolo_id, sede, attivo"

type CachedRolePermissions = {
  expiresAt: number
  pages: PermessoPaginaRow[]
  records: PermessoRecordRow[]
  ui: PermessoUiRow[]
  actions: PermessoAzioneRow[]
  fields: PermessoCampoRow[]
}

const rolePermissionCache = new Map<string, CachedRolePermissions>()

export function invalidateRolePermissionCache(roleId?: string) {
  // Uno snapshot utente incorpora i permessi del suo ruolo: se cambiano, gli
  // snapshot in cache diventano stantii. Non sapendo quali utenti abbiano quel
  // ruolo senza interrogare il DB, li azzeriamo tutti — sono ricostruibili e
  // costano una RPC a testa.
  invalidatePermissionSnapshotCache()

  if (roleId) {
    rolePermissionCache.delete(roleId)
    return
  }

  rolePermissionCache.clear()
}

function normalizePageAccess(value: PageAccess | boolean | null): PageAccess {
  if (value === true) return "rw"
  if (value === "r" || value === "rw" || value === "no_access") return value
  return "no_access"
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

async function selectOptionalPermissionRows<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  columns: string,
  roleId: string,
) {
  if (unavailableOptionalTables.has(table)) return [] as T[]

  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("ruolo_id", roleId)

  if (error) {
    if (isMissingTableError(error)) {
      unavailableOptionalTables.add(table)
    } else {
      console.warn(`[permissions] optional table ${table} warning:`, error.message)
    }
    return [] as T[]
  }

  return (data ?? []) as T[]
}

async function loadRolePermissionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roleId: string,
) {
  const cached = rolePermissionCache.get(roleId)
  if (cached && cached.expiresAt > Date.now()) return cached

  const [pagesRes, recordsRes, uiRes, fields, actions] = await Promise.all([
    supabase
      .from("permessi_pagina")
      .select("pagina, accesso")
      .eq("ruolo_id", roleId),
    supabase
      .from("permessi_record")
      .select("modulo, azione, abilitato")
      .eq("ruolo_id", roleId),
    supabase
      .from("permessi_ui")
      .select("chiave, abilitato")
      .eq("ruolo_id", roleId),
    selectOptionalPermissionRows<PermessoCampoRow>(
      supabase,
      "permessi_campo",
      "modulo, campo, accesso",
      roleId,
    ),
    selectOptionalPermissionRows<PermessoAzioneRow>(
      supabase,
      "permessi_azione",
      "azione, abilitato",
      roleId,
    ),
  ])
  // permessi_scope non viene piu' interrogata: la tabella non esiste nello
  // schema remoto (accertato il 25/07) e non e' stata creata di proposito —
  // lo scope per risorsa arriva dal default del ruolo e dalle chiavi di
  // permessi_ui. Interrogarla costava un giro di rete completo per fallire
  // ogni volta (~190ms), a ogni cold start serverless.
  //
  // permessi_azione invece ESISTE (era assente nel 2026-07, lo e' piu'):
  // resta interrogata, e dal 24/08 le sue policy la rendono anche scrivibile.

  const rows: CachedRolePermissions = {
    expiresAt: Date.now() + rolePermissionCacheMs,
    pages: (pagesRes.data ?? []) as PermessoPaginaRow[],
    records: (recordsRes.data ?? []) as PermessoRecordRow[],
    ui: (uiRes.data ?? []) as PermessoUiRow[],
    actions,
    fields,
  }

  rolePermissionCache.set(roleId, rows)
  return rows
}

/**
 * Esportata per il test: e' la funzione che traduce una riga di permessi_ui in
 * una modifica dello snapshot, ed e' dove viveva la mappatura sbagliata di
 * visibilita_sedi. Un errore qui non da' nessun sintomo visibile — allarga o
 * stringe l'ambito dati in silenzio — quindi va coperto.
 */
export function applyUiPermission(snapshot: PermissionSnapshot, row: PermessoUiRow) {
  const key = row.chiave
  const enabled = row.abilitato === true

  if (key === "visibilita_sedi") {
    // Spento significa "own", non "own_sede".
    //
    // La chiave e' binaria e il pannello la presenta come "Tutte le sedi" /
    // "Solo sede assegnata", ma il valore che conta e' lo scope applicato ai
    // moduli. Mappare lo spento su "own_sede" ALLARGAVA l'ambito di un AGENT,
    // il cui default in lib/permissions/constants.ts e' "own": salvare il
    // ruolo dal pannello — cosa che fino a ieri non funzionava, quindi il
    // problema non si vedeva — gli avrebbe dato accesso a tutti i record
    // della propria sede invece che ai soli propri.
    //
    // "own" e' anche la direzione sicura: fra due letture possibili di un
    // interruttore spento, si prende la piu' stretta.
    const scope = enabled ? "all" : "own"
    for (const moduleKey of Object.keys(snapshot.scopes)) snapshot.scopes[moduleKey] = scope
    return
  }

  if (key.startsWith("field:")) {
    const [, moduleKey, field, access] = key.split(":")
    if (!moduleKey || !field) return
    snapshot.fields[moduleKey] ??= {}
    snapshot.fields[moduleKey][field] = enabled ? ((access as FieldAccess) || "editable") : "hidden"
    return
  }

  if (key.startsWith("scope:")) {
    if (!enabled) return
    const [, resource, scope] = key.split(":")
    if (resource && scope) snapshot.scopes[resource] = scope as DataScope
    return
  }

  snapshot.actions[key] = enabled
}

async function loadCurrentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const user: AuthIdentity | null =
    typeof claims?.sub === "string"
      ? {
          id: claims.sub,
          email: typeof claims.email === "string" ? claims.email : null,
        }
      : null

  if (!user) {
    return { supabase, authUser: null, utente: null as UtenteRow | null }
  }

  const { data: byAuthUser } = await supabase
    .from("utenti")
    .select(permissionRowColumns)
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (byAuthUser) return { supabase, authUser: user, utente: byAuthUser as UtenteRow }

  const { data: byEmail } = await supabase
    .from("utenti")
    .select(permissionRowColumns)
    .eq("email", user.email ?? "")
    .maybeSingle()

  return { supabase, authUser: user, utente: (byEmail as UtenteRow | null) ?? null }
}

// --- Cache dello snapshot fra richieste -------------------------------------
// `cache()` di React deduplica solo DENTRO una singola richiesta: ogni
// navigazione ripagava per intero la RPC get_permission_snapshot (~66ms
// misurati), che è il pavimento sotto cui nessuna pagina poteva scendere.
// Qui teniamo lo snapshot in memoria di processo, per utente, con TTL breve.
//
// Tre precauzioni, perché sono dati di autorizzazione:
//  - TTL corto: una modifica ai permessi si propaga al massimo in TTL secondi
//    anche se l'invalidazione esplicita non viene chiamata o arriva da un
//    altro processo (su Vercel ogni lambda ha la sua memoria).
//  - clone in lettura: lo snapshot restituito non è mai l'oggetto in cache, così
//    una mutazione accidentale a valle non può trapelare a un'altra richiesta.
//  - mai in cache l'utente non autenticato.
//
// La durata è la stessa della cache dei permessi di ruolo qui sopra
// (PERMISSION_CACHE_MS: 30s in sviluppo, 60s in produzione), così esiste una
// sola manopola per entrambe.
type SnapshotCacheEntry = { snapshot: PermissionSnapshot; expiresAt: number }
const permissionSnapshotCache = new Map<string, SnapshotCacheEntry>()

/**
 * Svuota la cache degli snapshot. Va chiamata da ogni endpoint che modifica
 * permessi, ruoli o l'assegnazione di ruolo a un utente. Senza argomenti
 * azzera tutto: una modifica a un RUOLO tocca tutti gli utenti che lo hanno,
 * quindi invalidare il solo autore non basterebbe.
 */
export function invalidatePermissionSnapshotCache(authUserId?: string) {
  if (authUserId) permissionSnapshotCache.delete(authUserId)
  else permissionSnapshotCache.clear()
}

function rememberSnapshot(authUserId: string, snapshot: PermissionSnapshot) {
  permissionSnapshotCache.set(authUserId, {
    snapshot,
    expiresAt: Date.now() + rolePermissionCacheMs,
  })
  return snapshot
}

async function loadCurrentPermissionSnapshotUncached(): Promise<PermissionSnapshot> {
  const fastSupabase = await createClient()
  const { data: claimsData } = await fastSupabase.auth.getClaims()
  const claims = claimsData?.claims
  const fastAuthUser: AuthIdentity | null =
    typeof claims?.sub === "string"
      ? {
          id: claims.sub,
          email: typeof claims.email === "string" ? claims.email : null,
        }
      : null

  if (!fastAuthUser) {
    return buildDefaultPermissionSnapshot({
      ruoloCode: "STANDARD",
      ruoloNome: "Non autenticato",
    })
  }

  const cached = permissionSnapshotCache.get(fastAuthUser.id)
  if (cached && cached.expiresAt > Date.now()) {
    return structuredClone(cached.snapshot)
  }
  permissionSnapshotCache.delete(fastAuthUser.id)

  const { data: fastData, error: fastError } =
    await fastSupabase.rpc("get_permission_snapshot")
  if (!fastError && fastData && typeof fastData === "object") {
    const payload = fastData as {
      utente?: UtenteRow
      ruolo?: RuoloRow
      pages?: PermessoPaginaRow[]
      records?: PermessoRecordRow[]
      ui?: PermessoUiRow[]
      actions?: PermessoAzioneRow[]
      fields?: PermessoCampoRow[]
      scopes?: PermessoScopeRow[]
    }
    const utente = payload.utente
    const ruolo = payload.ruolo
    const ruoloCode = normalizeRoleCode(ruolo?.code ?? utente?.ruolo)
    const snapshot = buildDefaultPermissionSnapshot({
      authUserId: fastAuthUser.id,
      userId: utente?.id ?? null,
      email: utente?.email ?? fastAuthUser.email,
      // Il fallback all'email (se nome assente) è centralizzato in
      // buildDefaultPermissionSnapshot → resolveSubjectName.
      nome: utente?.nome ?? null,
      ruoloId: ruolo?.id ?? utente?.ruolo_id ?? null,
      ruoloCode,
      ruoloNome: ruolo?.nome ?? ruoloCode,
      sede: utente?.sede ?? null,
    })

    for (const row of payload.pages ?? [])
      snapshot.pages[row.pagina] = normalizePageAccess(row.accesso)
    for (const row of payload.records ?? []) {
      snapshot.records[row.modulo] ??= {}
      snapshot.records[row.modulo][row.azione] = row.abilitato === true
    }
    const uiRows = payload.ui ?? []
    const hasExplicitScopes = uiRows.some(
      (row) => row.abilitato === true && row.chiave.startsWith("scope:"),
    )
    for (const row of uiRows) {
      if (hasExplicitScopes && row.chiave === "visibilita_sedi") continue
      applyUiPermission(snapshot, row)
    }
    for (const row of payload.actions ?? [])
      snapshot.actions[row.azione] = row.abilitato === true
    for (const row of payload.fields ?? []) {
      snapshot.fields[row.modulo] ??= {}
      snapshot.fields[row.modulo][row.campo] = row.accesso ?? "hidden"
    }
    for (const row of payload.scopes ?? [])
      snapshot.scopes[row.risorsa] = row.scope ?? "none"

    if (snapshot.subject.ruoloId) {
      const roleRows = await loadRolePermissionRows(
        fastSupabase,
        snapshot.subject.ruoloId,
      )

      for (const row of roleRows.actions)
        snapshot.actions[row.azione] = row.abilitato === true
      for (const row of roleRows.fields) {
        snapshot.fields[row.modulo] ??= {}
        snapshot.fields[row.modulo][row.campo] = row.accesso ?? "hidden"
      }
    }

    return rememberSnapshot(fastAuthUser.id, snapshot)
  }

  // Non è strumentazione: segnala che la migration della RPC non è applicata e
  // che l'app sta girando sul percorso lento a query multiple.
  console.warn(
    `[permissions] RPC get_permission_snapshot non disponibile (${fastError?.message ?? "nessun dato"}): uso il fallback a query multiple.`,
  )
  // Fallback compatibile finché la migration RPC non è stata applicata.
  const { supabase, authUser, utente } = await loadCurrentUser()

  if (!authUser) {
    return buildDefaultPermissionSnapshot({ ruoloCode: "STANDARD", ruoloNome: "Non autenticato" })
  }

  let ruolo: RuoloRow | null = null
  if (utente?.ruolo_id) {
    const { data } = await supabase
      .from("ruoli")
      .select("id, code, nome")
      .eq("id", utente.ruolo_id)
      .maybeSingle()
    ruolo = (data as RuoloRow | null) ?? null
  }

  if (!ruolo && utente?.ruolo) {
    const { data } = await supabase
      .from("ruoli")
      .select("id, code, nome")
      .ilike("code", utente.ruolo)
      .maybeSingle()
    ruolo = (data as RuoloRow | null) ?? null
  }

  const ruoloCode = normalizeRoleCode(ruolo?.code ?? utente?.ruolo)
  const snapshot = buildDefaultPermissionSnapshot({
    authUserId: authUser.id,
    userId: utente?.id ?? null,
    email: utente?.email ?? authUser.email ?? null,
    // Vedi nota sopra: risoluzione nome/email centralizzata in resolveSubjectName.
    nome: utente?.nome ?? null,
    ruoloId: ruolo?.id ?? utente?.ruolo_id ?? null,
    ruoloCode,
    ruoloNome: ruolo?.nome ?? ruoloCode,
    sede: utente?.sede ?? null,
  })

  if (!snapshot.subject.ruoloId) return snapshot

  const roleRows = await loadRolePermissionRows(supabase, snapshot.subject.ruoloId)

  for (const row of roleRows.pages) {
    snapshot.pages[row.pagina] = normalizePageAccess(row.accesso)
  }

  for (const row of roleRows.records) {
    snapshot.records[row.modulo] ??= {}
    snapshot.records[row.modulo][row.azione] = row.abilitato === true
  }

  for (const row of roleRows.ui) {
    applyUiPermission(snapshot, row)
  }

  for (const row of roleRows.actions) {
    snapshot.actions[row.azione] = row.abilitato === true
  }

  for (const row of roleRows.fields) {
    snapshot.fields[row.modulo] ??= {}
    snapshot.fields[row.modulo][row.campo] = row.accesso ?? "hidden"
  }

  return rememberSnapshot(fastAuthUser.id, snapshot)
}

export const loadCurrentPermissionSnapshot = cache(loadCurrentPermissionSnapshotUncached)
