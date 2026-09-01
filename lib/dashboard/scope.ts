import type { PermissionSnapshot } from "@/lib/permissions/types"

type ScopeResource = "lead" | "clienti" | "compiti" | "scadenze" | "installatori"

type ScopedQuery = {
  eq: (column: string, value: string) => unknown
  in: (column: string, values: string[]) => unknown
  is: (column: string, value: null) => unknown
}

const OWNER_COLUMN: Record<ScopeResource, string | null> = {
  lead: "lead_proprietario_id",
  clienti: "clienti_proprietario_id",
  compiti: "proprietario_id",
  scadenze: "proprietario_id",
  installatori: "proprietario_id",
}

export function applyDashboardScope<Q>(
  query: Q,
  snapshot: PermissionSnapshot,
  resource: ScopeResource,
  teamOwnerIds: string[] = [],
): Q {
  const scoped = query as ScopedQuery
  const scope = snapshot.scopes[resource] ?? "none"
  const subject = snapshot.subject

  if (scope === "all" || subject.ruoloCode === "SUPERADMIN") return query

  if ((scope === "assigned" || scope === "own") && subject.userId) {
    const column = OWNER_COLUMN[resource]
    return column ? (scoped.eq(column, subject.userId) as Q) : query
  }

  if (scope === "team") {
    const column = OWNER_COLUMN[resource]
    const ids = [...new Set([subject.userId, ...teamOwnerIds].filter((id): id is string => Boolean(id)))]
    return column && ids.length > 0 ? (scoped.in(column, ids) as Q) : (scoped.is("id", null) as Q)
  }

  // Le configurazioni legacy basate sulla sede sono deliberatamente
  // ristrette al proprietario corrente.
  if (scope === "own_sede" && subject.userId) {
    const column = OWNER_COLUMN[resource]
    return column ? (scoped.eq(column, subject.userId) as Q) : query
  }

  return scoped.is("id", null) as Q
}

export function dashboardScopeDescription(snapshot: PermissionSnapshot, resource: ScopeResource) {
  return `${resource}:${snapshot.scopes[resource] ?? "none"}`
}
