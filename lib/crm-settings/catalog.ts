import type { LucideIcon } from "lucide-react"
import {
  Building2,
  DatabaseBackup,
  KeyRound,
  PlugZap,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"

export type CrmSettingsLayer =
  | "root"
  | "account-security"
  | "file-manager"
  | "system"

export type CrmSettingsSectionId =
  | "account"
  | "organization"
  | "integrations"
  | "infrastructure"

export interface CrmSettingsCatalogItem {
  id: string
  section: CrmSettingsSectionId
  title: string
  description: string
  href: string
  pageKey: string
  icon: LucideIcon
  status?: "active" | "restricted"
}

export const CRM_SETTINGS_SECTIONS: Record<
  CrmSettingsSectionId,
  { title: string; description: string }
> = {
  account: {
    title: "Account e accessi",
    description: "Utenti, ruoli e sicurezza",
  },
  organization: {
    title: "Organizzazione",
    description: "Struttura aziendale e sedi operative",
  },
  integrations: {
    title: "Integrazioni",
    description: "Servizi e automazioni trasversali",
  },
  infrastructure: {
    title: "Infrastruttura",
    description: "Controlli tecnici riservati",
  },
}

export const CRM_SETTINGS_CATALOG: CrmSettingsCatalogItem[] = [
  {
    id: "accounts",
    section: "account",
    title: "Account",
    description: "Utenti, ruoli e sedi assegnate",
    href: "/crm-settings/account/utenti",
    pageKey: "crm_settings.account.utenti",
    icon: Users,
    status: "active",
  },
  {
    id: "permissions",
    section: "account",
    title: "Ruoli e permessi",
    description: "Accessi a pagine, dati e operazioni",
    href: "/crm-settings/account/permessi",
    pageKey: "crm_settings.account.permessi",
    icon: ShieldCheck,
    status: "active",
  },
  {
    id: "audit",
    section: "account",
    title: "Audit e log",
    description: "Accessi e modifiche rilevanti",
    href: "/crm-settings/account/audit",
    pageKey: "crm_settings.account.audit",
    icon: ScrollText,
    status: "restricted",
  },
  {
    id: "sessions",
    section: "account",
    title: "Sessioni e sicurezza",
    description: "Sessioni, dispositivi e criteri di accesso",
    href: "/crm-settings/account/session",
    pageKey: "crm_settings.account.session",
    icon: KeyRound,
    status: "restricted",
  },
  {
    id: "sites",
    section: "organization",
    title: "Sedi e territori",
    description: "Sedi operative usate da utenti e dashboard",
    href: "/crm-settings/system/sedi",
    pageKey: "crm_settings.system.sedi",
    icon: Building2,
    status: "active",
  },
  {
    id: "make",
    section: "integrations",
    title: "Make",
    description: "Connessioni e webhook aziendali",
    href: "/crm-settings/system/make",
    pageKey: "crm_settings.system.make",
    icon: PlugZap,
  },
  {
    id: "backup",
    section: "infrastructure",
    title: "Backup",
    description: "Operazioni tecniche sul database",
    href: "/crm-settings/system/backup",
    pageKey: "crm_settings.system.backup",
    icon: DatabaseBackup,
    status: "restricted",
  },
]

export const CRM_SETTINGS_PAGE_TITLES = Object.fromEntries(
  CRM_SETTINGS_CATALOG.map((item) => [item.href, item.title]),
)

export function crmSettingsItemForPath(pathname: string) {
  return CRM_SETTINGS_CATALOG.find((item) => item.href === pathname)
}
