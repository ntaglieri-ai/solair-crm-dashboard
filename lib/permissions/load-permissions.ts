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
  scopes: PermessoScopeRow[]
}

const rolePermissionCache = new Map<string, CachedRolePermissions>()

export function invalidateRolePermissionCache(roleId?: string) {
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

  const [pagesRes, recordsRes, uiRes, actions, fields, scopes] = await Promise.all([
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
    selectOptionalPermissionRows<PermessoAzioneRow>(
      supabase,
      "permessi_azione",
      "azione, abilitato",
      roleId,
    ),
    selectOptionalPermissionRows<PermessoCampoRow>(
      supabase,
      "permessi_campo",
      "modulo, campo, accesso",
      roleId,
    ),
    selectOptionalPermissionRows<PermessoScopeRow>(
      supabase,
      "permessi_scope",
      "risorsa, scope",
      roleId,
    ),
  ])

  const rows: CachedRolePermissions = {
    expiresAt: Date.now() + rolePermissionCacheMs,
    pages: (pagesRes.data ?? []) as PermessoPaginaRow[],
    records: (recordsRes.data ?? []) as PermessoRecordRow[],
    ui: (uiRes.data ?? []) as PermessoUiRow[],
    actions,
    fields,
    scopes,
  }

  rolePermissionCache.set(roleId, rows)
  return rows
}

function applyUiPermission(snapshot: PermissionSnapshot, row: PermessoUiRow) {
  const key = row.chiave
  const enabled = row.abilitato === true

  if (key === "visibilita_sedi") {
    const scope = enabled ? "all" : "own_sede"
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
    for (const row of payload.ui ?? []) applyUiPermission(snapshot, row)
    for (const row of payload.actions ?? [])
      snapshot.actions[row.azione] = row.abilitato === true
    for (const row of payload.fields ?? []) {
      snapshot.fields[row.modulo] ??= {}
      snapshot.fields[row.modulo][row.campo] = row.accesso ?? "hidden"
    }
    for (const row of payload.scopes ?? [])
      snapshot.scopes[row.risorsa] = row.scope ?? "none"

    return snapshot
  }

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

  for (const row of roleRows.scopes) {
    snapshot.scopes[row.risorsa] = row.scope ?? "none"
  }

  return snapshot
}

export const loadCurrentPermissionSnapshot = cache(loadCurrentPermissionSnapshotUncached)
