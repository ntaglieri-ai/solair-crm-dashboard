export type PageAccess = "no_access" | "r" | "rw"
export type FieldAccess = "hidden" | "readonly" | "editable"
export type DataScope = "none" | "own" | "own_sede" | "assigned" | "team" | "all"
export type RecordAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "assign"
  | "import"
  | "bulk_update"

export type RoleCode =
  | "SUPERADMIN"
  | "ADMIN"
  | "DIRECTOR"
  | "STANDARD"
  | "AGENT"
  | string

export interface PermissionSubject {
  authUserId: string | null
  userId: string | null
  email: string | null
  nome: string
  iniziali: string
  ruoloId: string | null
  ruoloCode: RoleCode
  ruoloNome: string
  sede: string | null
}

export interface PermissionSnapshot {
  subject: PermissionSubject
  pages: Record<string, PageAccess>
  records: Record<string, Record<string, boolean>>
  fields: Record<string, Record<string, FieldAccess>>
  actions: Record<string, boolean>
  scopes: Record<string, DataScope>
}

export interface PermissionEngine {
  snapshot: PermissionSnapshot
  isSuperadmin: boolean
  canPage: (page: string) => boolean
  pageAccess: (page: string) => PageAccess
  canRecord: (module: string, action: RecordAction | string) => boolean
  canField: (module: string, field: string, access?: "view" | "edit") => boolean
  fieldAccess: (module: string, field: string) => FieldAccess
  canAction: (action: string) => boolean
  getScope: (resource: string) => DataScope
}
