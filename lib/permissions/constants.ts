import type {
  DataScope,
  FieldAccess,
  PageAccess,
  PermissionSnapshot,
  RecordAction,
  RoleCode,
} from "./types"
import { buildFieldPermissionsForRole } from "./field-catalog"

export const PAGE_KEYS = [
  "dashboard",
  "lead",
  "clienti",
  "compiti",
  "scadenze",
  "documenti",
  "installatori",
  "crm_settings",
  "crm_settings.account",
  "crm_settings.account.utenti",
  "crm_settings.account.permessi",
  "crm_settings.account.audit",
  "crm_settings.account.session",
  "crm_settings.system",
  "crm_settings.system.azienda",
  "crm_settings.system.sedi",
  "crm_settings.system.aspetto",
  "crm_settings.system.attributi",
  "crm_settings.system.valori",
  "crm_settings.system.regole",
  "crm_settings.system.flussi",
  "crm_settings.system.import_export",
  "crm_settings.system.make",
  "crm_settings.system.backup",
  "crm_settings.maintenance",
  "crm_settings.maintenance.health",
  "crm_settings.file_manager",
] as const

export const ROUTE_PAGE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/leads": "lead",
  "/clienti": "clienti",
  "/compiti": "compiti",
  "/scadenze": "scadenze",
  "/documenti": "documenti",
  "/installatori": "installatori",
  "/crm-settings": "crm_settings",
  "/crm-settings/account": "crm_settings.account",
  "/crm-settings/account/utenti": "crm_settings.account.utenti",
  "/crm-settings/account/permessi": "crm_settings.account.permessi",
  "/crm-settings/account/audit": "crm_settings.account.audit",
  "/crm-settings/account/session": "crm_settings.account.session",
  "/crm-settings/system": "crm_settings.system",
  "/crm-settings/system/azienda": "crm_settings.system.azienda",
  "/crm-settings/system/sedi": "crm_settings.system.sedi",
  "/crm-settings/system/aspetto": "crm_settings.system.aspetto",
  "/crm-settings/system/attributi": "crm_settings.system.attributi",
  "/crm-settings/system/valori": "crm_settings.system.valori",
  "/crm-settings/system/regole": "crm_settings.system.regole",
  "/crm-settings/system/flussi": "crm_settings.system.flussi",
  "/crm-settings/system/import-export": "crm_settings.system.import_export",
  "/crm-settings/system/make": "crm_settings.system.make",
  "/crm-settings/system/backup": "crm_settings.system.backup",
  "/crm-settings/maintenance": "crm_settings.maintenance",
  "/crm-settings/maintenance/health": "crm_settings.maintenance.health",
  "/crm-settings/maintenance/make": "crm_settings.system.make",
  "/crm-settings/maintenance/backup": "crm_settings.system.backup",
  "/crm-settings/maintenance/file-manager": "crm_settings.file_manager",
  "/crm-settings/maintenance/storage": "crm_settings.file_manager",
  "/crm-settings/file-manager": "crm_settings.file_manager",
}

export const MODULE_KEYS = [
  "lead",
  "clienti",
  "compiti",
  "scadenze",
  "documenti",
  "installatori",
] as const

export const RECORD_ACTIONS: RecordAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "assign",
  "import",
  "bulk_update",
]

export const ACTION_KEYS = [
  "crm_settings.account.audit.view",
  "crm_settings.account.session.view",
  "crm_settings.account.users.manage",
  "crm_settings.account.roles.manage",
  "crm_settings.system.backup.view",
  "crm_settings.system.backup.run",
  "crm_settings.system.maintenance.run",
  "crm_settings.system.schema.manage",
  "crm_settings.system.default_values.manage",
  "company.profile.view",
  "company.profile.edit",
  "company.sites.view",
  "company.sites.manage",
  "appearance.personal.manage",
  "lead.columns.customize_own",
  "lead.tags.edit",
  "lead.default_values.manage",
  "lead.assignment_rules.manage",
  "lead.workflows.manage",
  "lead.fields.view",
  "lead.fields.create",
  "lead.fields.edit",
  "lead.fields.delete",
  "lead.fields.reorder",
  "lead.fields.visibility.manage",
  "lead.fields.required.manage",
  "clienti.fields.view",
  "clienti.fields.create",
  "clienti.fields.edit",
  "clienti.fields.delete",
  "clienti.default_values.manage",
  "clienti.assignment_rules.manage",
  "clienti.workflows.manage",
  "compiti.fields.view",
  "compiti.fields.create",
  "compiti.fields.edit",
  "compiti.fields.delete",
  "compiti.default_values.manage",
  "compiti.assignment_rules.manage",
  "compiti.workflows.manage",
  "scadenze.fields.view",
  "scadenze.fields.create",
  "scadenze.fields.edit",
  "scadenze.fields.delete",
  "scadenze.default_values.manage",
  "scadenze.assignment_rules.manage",
  "scadenze.workflows.manage",
  "installatori.fields.view",
  "installatori.fields.create",
  "installatori.fields.edit",
  "installatori.fields.delete",
  "installatori.default_values.manage",
  "installatori.assignment_rules.manage",
  "installatori.workflows.manage",
] as const

export function normalizeRoleCode(value: string | null | undefined): RoleCode {
  return (value ?? "STANDARD").trim().toUpperCase() || "STANDARD"
}

/**
 * Nome visualizzato per l'utente corrente: usa il `nome` da `utenti` (senza
 * spazi superflui) e ricade sull'email SOLO se il nome è genuinamente
 * assente — null, undefined o stringa vuota/whitespace. Ultimo fallback
 * "Utente" per non mostrare mai una greeting vuota.
 */
export function resolveSubjectName(
  nome: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedNome = nome?.trim()
  if (trimmedNome) return trimmedNome
  const trimmedEmail = email?.trim()
  if (trimmedEmail) return trimmedEmail
  return "Utente"
}

function initialsFromName(value: string | null | undefined) {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "UT"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function recordForAllPages(access: PageAccess) {
  return Object.fromEntries(PAGE_KEYS.map((page) => [page, access]))
}

function recordForAllActions(enabled: boolean) {
  return Object.fromEntries(ACTION_KEYS.map((action) => [action, enabled]))
}

function recordPermissions(enabled: boolean) {
  return Object.fromEntries(
    MODULE_KEYS.map((moduleKey) => [
      moduleKey,
      Object.fromEntries(RECORD_ACTIONS.map((action) => [action, enabled])),
    ]),
  ) as Record<string, Record<string, boolean>>
}

function defaultFields(access: FieldAccess): Record<string, Record<string, FieldAccess>> {
  return Object.fromEntries(MODULE_KEYS.map((moduleKey) => [moduleKey, { "*": access }]))
}

function defaultScopes(scope: DataScope) {
  return Object.fromEntries(MODULE_KEYS.map((moduleKey) => [moduleKey, scope]))
}

export function buildDefaultPermissionSnapshot(params?: {
  authUserId?: string | null
  userId?: string | null
  email?: string | null
  nome?: string | null
  ruoloId?: string | null
  ruoloCode?: string | null
  ruoloNome?: string | null
  sede?: string | null
}): PermissionSnapshot {
  const roleCode = normalizeRoleCode(params?.ruoloCode)
  const roleName = params?.ruoloNome ?? roleCode
  const pages = recordForAllPages("no_access")
  const records = recordPermissions(false)
  const fields = defaultFields("hidden")
  const actions = recordForAllActions(false)
  const scopes = defaultScopes("none")
  const roleFields = buildFieldPermissionsForRole(roleCode)

  const grantPages = (access: PageAccess, keys: string[]) => {
    for (const key of keys) pages[key] = access
  }
  const grantRecords = (modules: string[], enabledActions: string[]) => {
    for (const moduleKey of modules) {
      records[moduleKey] ??= {}
      for (const action of enabledActions) records[moduleKey][action] = true
    }
  }
  const grantActions = (keys: string[]) => {
    for (const key of keys) actions[key] = true
  }
  const grantFieldManagement = (modules: string[]) => {
    for (const moduleKey of modules) {
      actions[`${moduleKey}.fields.view`] = true
      actions[`${moduleKey}.fields.create`] = true
      actions[`${moduleKey}.fields.edit`] = true
      actions[`${moduleKey}.fields.visibility.manage`] = true
      actions[`${moduleKey}.fields.required.manage`] = true
    }
  }

  if (roleCode === "SUPERADMIN") {
    Object.assign(pages, recordForAllPages("rw"))
    Object.assign(actions, recordForAllActions(true))
    for (const moduleKey of MODULE_KEYS) {
      records[moduleKey] = Object.fromEntries(RECORD_ACTIONS.map((action) => [action, true]))
      fields[moduleKey] = roleFields[moduleKey] ?? { "*": "editable" }
      scopes[moduleKey] = "all"
    }
  } else if (roleCode === "ADMIN") {
    grantPages("rw", [
      "dashboard",
      "lead",
      "clienti",
      "compiti",
      "scadenze",
      "documenti",
      "installatori",
      "crm_settings",
      "crm_settings.account",
      "crm_settings.account.utenti",
      "crm_settings.account.permessi",
      "crm_settings.system",
      "crm_settings.system.azienda",
      "crm_settings.system.sedi",
      "crm_settings.system.aspetto",
      "crm_settings.system.attributi",
      "crm_settings.system.valori",
      "crm_settings.system.regole",
      "crm_settings.system.flussi",
      "crm_settings.system.make",
      "crm_settings.system.import_export",
    ])
    grantRecords([...MODULE_KEYS], ["view", "create", "edit", "delete", "export", "assign"])
    grantActions([
      "crm_settings.account.users.manage",
      "crm_settings.account.roles.manage",
      "lead.columns.customize_own",
      "lead.tags.edit",
      "lead.default_values.manage",
      "crm_settings.system.schema.manage",
      "crm_settings.system.default_values.manage",
      "company.profile.view",
      "company.profile.edit",
      "company.sites.view",
      "company.sites.manage",
      "appearance.personal.manage",
    ])
    grantFieldManagement([...MODULE_KEYS])
    for (const moduleKey of MODULE_KEYS) {
      records[moduleKey].import = true
      actions[`${moduleKey}.default_values.manage`] = true
      actions[`${moduleKey}.assignment_rules.manage`] = true
      actions[`${moduleKey}.workflows.manage`] = true
      fields[moduleKey] = roleFields[moduleKey] ?? { "*": "editable" }
      scopes[moduleKey] = "all"
    }
  } else if (roleCode === "AGENT") {
    grantPages("rw", ["lead", "compiti", "scadenze", "installatori"])
    // CRM Settings negato: restano leggibili solo azienda/sedi/aspetto (info
    // aziendali + personalizzazione aspetto proprio).
    grantPages("r", ["dashboard", "clienti", "documenti", "crm_settings.system.azienda", "crm_settings.system.sedi", "crm_settings.system.aspetto"])
    grantRecords(["lead", "clienti", "compiti", "scadenze"], ["view", "create", "edit"])
    grantActions(["lead.columns.customize_own", "lead.tags.edit", "company.profile.view", "company.sites.view", "appearance.personal.manage"])
    for (const moduleKey of MODULE_KEYS) {
      fields[moduleKey] = roleFields[moduleKey] ?? { "*": "editable" }
      scopes[moduleKey] = "assigned"
    }
  } else if (roleCode === "DIRECTOR") {
    grantPages("rw", ["dashboard", "lead", "clienti", "compiti", "scadenze", "installatori"])
    // Documenti in sola lettura; Automazioni (flussi/make) in lettura; CRM
    // Settings negato tranne azienda/sedi/aspetto leggibili; Manutenzione negata.
    grantPages("r", ["documenti", "crm_settings.system.flussi", "crm_settings.system.make", "crm_settings.system.azienda", "crm_settings.system.sedi", "crm_settings.system.aspetto"])
    grantRecords(["lead", "clienti", "compiti", "scadenze"], [
      "view",
      "create",
      "edit",
      "export",
      "assign",
    ])
    grantActions(["lead.columns.customize_own", "lead.tags.edit", "company.profile.view", "company.sites.view", "appearance.personal.manage"])
    for (const moduleKey of MODULE_KEYS) {
      fields[moduleKey] = roleFields[moduleKey] ?? { "*": "readonly" }
      scopes[moduleKey] = "own_sede"
    }
  } else {
    grantPages("rw", ["lead", "clienti", "compiti", "scadenze", "installatori"])
    // CRM Settings negato tranne azienda/sedi/aspetto leggibili; Documenti in
    // sola lettura; Automazioni e Manutenzione negate.
    grantPages("r", ["dashboard", "documenti", "crm_settings.system.azienda", "crm_settings.system.sedi", "crm_settings.system.aspetto"])
    grantRecords(["lead", "clienti", "compiti", "scadenze"], ["view"])
    grantActions(["lead.columns.customize_own", "company.profile.view", "company.sites.view", "appearance.personal.manage"])
    for (const moduleKey of MODULE_KEYS) {
      fields[moduleKey] = roleFields[moduleKey] ?? { "*": "readonly" }
      scopes[moduleKey] = "own"
    }
  }

  return {
    subject: {
      authUserId: params?.authUserId ?? null,
      userId: params?.userId ?? null,
      email: params?.email ?? null,
      nome: resolveSubjectName(params?.nome, params?.email),
      iniziali: initialsFromName(resolveSubjectName(params?.nome, params?.email)),
      ruoloId: params?.ruoloId ?? null,
      ruoloCode: roleCode,
      ruoloNome: roleName,
      sede: params?.sede ?? null,
    },
    pages,
    records,
    fields,
    actions,
    scopes,
  }
}

export function pageKeyFromPath(pathname: string) {
  const exact = ROUTE_PAGE_MAP[pathname]
  if (exact) return exact

  const match = Object.keys(ROUTE_PAGE_MAP)
    .filter((route) => route !== "/" && pathname.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0]

  return match ? ROUTE_PAGE_MAP[match] : null
}
