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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, authUser: null, utente: null as UtenteRow | null }
  }

  const { data: byAuthUser } = await supabase
    .from("utenti")
    .select("id, auth_user_id, nome, email, ruolo, ruolo_id, sede, attivo")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (byAuthUser) return { supabase, authUser: user, utente: byAuthUser as UtenteRow }

  const { data: byEmail } = await supabase
    .from("utenti")
    .select("id, auth_user_id, nome, email, ruolo, ruolo_id, sede, attivo")
    .eq("email", user.email ?? "")
    .maybeSingle()

  return { supabase, authUser: user, utente: (byEmail as UtenteRow | null) ?? null }
}

async function loadCurrentPermissionSnapshotUncached(): Promise<PermissionSnapshot> {
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
    nome: utente?.nome ?? authUser.email ?? "Utente",
    ruoloId: ruolo?.id ?? utente?.ruolo_id ?? null,
    ruoloCode,
    ruoloNome: ruolo?.nome ?? ruoloCode,
    sede: utente?.sede ?? null,
  })

  if (!snapshot.subject.ruoloId) return snapshot

  const [pagesRes, recordsRes, uiRes] = await Promise.all([
    supabase
      .from("permessi_pagina")
      .select("pagina, accesso")
      .eq("ruolo_id", snapshot.subject.ruoloId),
    supabase
      .from("permessi_record")
      .select("modulo, azione, abilitato")
      .eq("ruolo_id", snapshot.subject.ruoloId),
    supabase
      .from("permessi_ui")
      .select("chiave, abilitato")
      .eq("ruolo_id", snapshot.subject.ruoloId),
  ])

  const [actionsRows, fieldsRows, scopesRows] = await Promise.all([
    selectOptionalPermissionRows<PermessoAzioneRow>(
      supabase,
      "permessi_azione",
      "azione, abilitato",
      snapshot.subject.ruoloId,
    ),
    selectOptionalPermissionRows<PermessoCampoRow>(
      supabase,
      "permessi_campo",
      "modulo, campo, accesso",
      snapshot.subject.ruoloId,
    ),
    selectOptionalPermissionRows<PermessoScopeRow>(
      supabase,
      "permessi_scope",
      "risorsa, scope",
      snapshot.subject.ruoloId,
    ),
  ])

  for (const row of ((pagesRes.data ?? []) as PermessoPaginaRow[])) {
    snapshot.pages[row.pagina] = normalizePageAccess(row.accesso)
  }

  for (const row of ((recordsRes.data ?? []) as PermessoRecordRow[])) {
    snapshot.records[row.modulo] ??= {}
    snapshot.records[row.modulo][row.azione] = row.abilitato === true
  }

  for (const row of ((uiRes.data ?? []) as PermessoUiRow[])) {
    applyUiPermission(snapshot, row)
  }

  for (const row of actionsRows) {
    snapshot.actions[row.azione] = row.abilitato === true
  }

  for (const row of fieldsRows) {
    snapshot.fields[row.modulo] ??= {}
    snapshot.fields[row.modulo][row.campo] = row.accesso ?? "hidden"
  }

  for (const row of scopesRows) {
    snapshot.scopes[row.risorsa] = row.scope ?? "none"
  }

  return snapshot
}

export const loadCurrentPermissionSnapshot = cache(loadCurrentPermissionSnapshotUncached)
