import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { loadCurrentPermissionSnapshot } from "./load-permissions"
import type { DataScope, PermissionSnapshot } from "./types"

export type OwnerScope =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "owners"; ownerIds: string[] }

const loadTeamAgentIds = cache(async (directorId: string): Promise<string[]> => {
  const supabase = await createClient()
  const { data: directed, error: directorError } = await supabase
    .from("team_direttori")
    .select("team_id")
    .eq("utente_id", directorId)

  if (directorError) {
    // Compatibilita' durante il rollout: prima della migration un Direttore
    // senza struttura team conserva il perimetro minimo, cioe' solo se stesso.
    console.warn("[permissions/data-scope] team_direttori:", directorError.message)
    return []
  }

  const teamIds = (directed ?? []).map((row) => row.team_id as string)
  if (teamIds.length === 0) return []

  const { data: agents, error: agentsError } = await supabase
    .from("team_agenti")
    .select("utente_id")
    .in("team_id", teamIds)

  if (agentsError) {
    console.warn("[permissions/data-scope] team_agenti:", agentsError.message)
    return []
  }
  return (agents ?? []).map((row) => row.utente_id as string)
})

export async function resolveOwnerScope(
  snapshot: PermissionSnapshot,
  resource: string,
): Promise<OwnerScope> {
  const configured = snapshot.scopes[resource] ?? "none"
  // La sede non determina piu' la visibilita'. Le configurazioni legacy
  // own_sede vengono ristrette al solo proprietario corrente.
  const scope: DataScope = configured === "own_sede" ? "own" : configured

  if (scope === "all" || snapshot.subject.ruoloCode === "SUPERADMIN") {
    return { kind: "all" }
  }

  const userId = snapshot.subject.userId
  if (!userId) return { kind: "none" }

  if (scope === "own" || scope === "assigned") {
    return { kind: "owners", ownerIds: [userId] }
  }

  if (scope === "team") {
    const agents = await loadTeamAgentIds(userId)
    return { kind: "owners", ownerIds: [...new Set([userId, ...agents])] }
  }

  return { kind: "none" }
}

export async function resolveCurrentOwnerScope(resource: string): Promise<OwnerScope> {
  return resolveOwnerScope(await loadCurrentPermissionSnapshot(), resource)
}

type OwnerFilterQuery<Q> = {
  in: (column: string, values: string[]) => Q
}

export function applyOwnerScope<Q>(
  query: Q,
  ownerColumn: string,
  scope: OwnerScope,
): Q {
  if (scope.kind === "all") return query
  const scoped = query as OwnerFilterQuery<Q>
  if (scope.kind === "owners" && scope.ownerIds.length > 0) {
    return scoped.in(ownerColumn, scope.ownerIds)
  }
  // Le colonne proprietario del CRM sono UUID: questo valore non puo'
  // corrispondere a un utente reale e, soprattutto, non include i non assegnati.
  return scoped.in(ownerColumn, ["00000000-0000-0000-0000-000000000000"])
}

export async function canAccessOwnedRecord(
  snapshot: PermissionSnapshot,
  resource: string,
  table: string,
  ownerColumn: string,
  recordId: string,
): Promise<boolean> {
  const scope = await resolveOwnerScope(snapshot, resource)
  if (scope.kind === "all") return true
  if (scope.kind === "none") return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", recordId)
    .in(ownerColumn, scope.ownerIds)
    .maybeSingle()
  if (error) {
    console.error(`[permissions/data-scope] verifica ${table}:`, error.message)
    return false
  }
  return Boolean(data)
}

const CRM_RECORD_SCOPE = {
  lead: { resource: "lead", table: "leads", ownerColumn: "lead_proprietario_id" },
  cliente: { resource: "clienti", table: "clienti", ownerColumn: "clienti_proprietario_id" },
  compito: { resource: "compiti", table: "compiti", ownerColumn: "proprietario_id" },
  scadenza: { resource: "scadenze", table: "scadenze", ownerColumn: "proprietario_id" },
  installatore: { resource: "installatori", table: "installatori", ownerColumn: "proprietario_id" },
} as const

export type ScopedCrmRecordType = keyof typeof CRM_RECORD_SCOPE

export async function canAccessCrmRecord(
  snapshot: PermissionSnapshot,
  recordType: ScopedCrmRecordType,
  recordId: string,
): Promise<boolean> {
  const config = CRM_RECORD_SCOPE[recordType]
  return canAccessOwnedRecord(
    snapshot,
    config.resource,
    config.table,
    config.ownerColumn,
    recordId,
  )
}

export async function filterAccessibleRecordIds(
  snapshot: PermissionSnapshot,
  resource: string,
  table: string,
  ownerColumn: string,
  recordIds: string[],
): Promise<string[]> {
  const unique = [...new Set(recordIds)]
  if (unique.length === 0) return []
  const scope = await resolveOwnerScope(snapshot, resource)
  if (scope.kind === "all") return unique
  if (scope.kind === "none") return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .in("id", unique)
    .in(ownerColumn, scope.ownerIds)
  if (error) {
    console.error(`[permissions/data-scope] filtro ${table}:`, error.message)
    return []
  }
  return (data ?? []).map((row) => row.id as string)
}

export async function filterCurrentAccessibleRecordIds(
  resource: string,
  table: string,
  ownerColumn: string,
  recordIds: string[],
): Promise<string[]> {
  const snapshot = await loadCurrentPermissionSnapshot()
  return filterAccessibleRecordIds(snapshot, resource, table, ownerColumn, recordIds)
}
