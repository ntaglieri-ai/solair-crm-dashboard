import type {
  DataScope,
  FieldAccess,
  PageAccess,
  PermissionEngine,
  PermissionSnapshot,
} from "./types"

function pageAccessAllows(access: PageAccess | undefined) {
  return access === "r" || access === "rw"
}

export function createPermissionEngine(snapshot: PermissionSnapshot): PermissionEngine {
  const isSuperadmin = snapshot.subject.ruoloCode === "SUPERADMIN"

  function pageAccess(page: string): PageAccess {
    const direct = snapshot.pages[page]
    if (direct) return direct

    const parent = page.split(".").slice(0, -1).join(".")
    return parent ? pageAccess(parent) : "no_access"
  }

  function canPage(page: string) {
    return pageAccessAllows(pageAccess(page))
  }

  function canRecord(module: string, action: string) {
    return snapshot.records[module]?.[action] === true
  }

  function fieldAccess(module: string, field: string): FieldAccess {
    return snapshot.fields[module]?.[field] ?? snapshot.fields[module]?.["*"] ?? "hidden"
  }

  function canField(module: string, field: string, access: "view" | "edit" = "view") {
    const current = fieldAccess(module, field)
    if (access === "view") return current === "readonly" || current === "editable"
    return current === "editable"
  }

  function canAction(action: string) {
    return snapshot.actions[action] === true
  }

  function getScope(resource: string): DataScope {
    return snapshot.scopes[resource] ?? "none"
  }

  return {
    snapshot,
    isSuperadmin,
    canPage,
    pageAccess,
    canRecord,
    canField,
    fieldAccess,
    canAction,
    getScope,
  }
}
