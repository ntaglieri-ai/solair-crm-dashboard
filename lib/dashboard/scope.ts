import type { PermissionSnapshot } from "@/lib/permissions/types"

type ScopeResource = "lead" | "clienti" | "compiti" | "scadenze" | "installatori"

type ScopedQuery = {
  eq: (column: string, value: string) => unknown
  is: (column: string, value: null) => unknown
}

const OWNER_COLUMN: Record<ScopeResource, string | null> = {
  lead: "lead_proprietario_id",
  clienti: "clienti_proprietario_id",
  compiti: "proprietario_id",
  scadenze: "proprietario_id",
  installatori: "proprietario_id",
}

const SEDE_COLUMN: Record<ScopeResource, string | null> = {
  lead: "sede",
  clienti: "sede",
  compiti: "sede",
  scadenze: null,
  installatori: null,
}

export function applyDashboardScope<Q>(
  query: Q,
  snapshot: PermissionSnapshot,
  resource: ScopeResource,
): Q {
  const scoped = query as ScopedQuery
  const scope = snapshot.scopes[resource] ?? "none"
  const subject = snapshot.subject

  if (scope === "all" || subject.ruoloCode === "SUPERADMIN") return query

  if ((scope === "assigned" || scope === "own") && subject.userId) {
    const column = OWNER_COLUMN[resource]
    return column ? (scoped.eq(column, subject.userId) as Q) : query
  }

  if (scope === "own_sede" && subject.sede) {
    const column = SEDE_COLUMN[resource]
    return column ? (scoped.eq(column, subject.sede) as Q) : query
  }

  return scoped.is("id", null) as Q
}

export function dashboardScopeDescription(snapshot: PermissionSnapshot, resource: ScopeResource) {
  return `${resource}:${snapshot.scopes[resource] ?? "none"}`
}
