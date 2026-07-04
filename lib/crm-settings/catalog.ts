import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Building,
  Building2,
  DatabaseBackup,
  FileCog,
  KeyRound,
  Palette,
  PlugZap,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"

export type CrmSettingsLayer =
  | "root"
  | "account-security"
  | "maintenance"
  | "system"

export type CrmSettingsSectionId =
  | "account"
  | "organization"
  | "maintenance"

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
  maintenance: {
    title: "Manutenzione",
    description: "Integrazioni, servizi e controlli tecnici",
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
    id: "company",
    section: "organization",
    title: "Informazioni aziendali",
    description: "Identità, contatti e logo aziendale",
    href: "/crm-settings/system/azienda",
    pageKey: "crm_settings.system.azienda",
    icon: Building,
    status: "active",
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
    id: "appearance",
    section: "organization",
    title: "Aspetto personale",
    description: "Tema e preferenze salvate per il tuo account",
    href: "/crm-settings/system/aspetto",
    pageKey: "crm_settings.system.aspetto",
    icon: Palette,
    status: "active",
  },
  {
    id: "make",
    section: "maintenance",
    title: "Integrazioni Make",
    description: "Sito, Meta Ads, parametri e stato connessioni",
    href: "/crm-settings/maintenance/make",
    pageKey: "crm_settings.system.make",
    icon: PlugZap,
    status: "restricted",
  },
  {
    id: "backup",
    section: "maintenance",
    title: "Backup",
    description: "Operazioni tecniche sul database",
    href: "/crm-settings/maintenance/backup",
    pageKey: "crm_settings.system.backup",
    icon: DatabaseBackup,
    status: "restricted",
  },
  {
    id: "health",
    section: "maintenance",
    title: "Health check",
    description: "Stato reale dei servizi collegati al CRM",
    href: "/crm-settings/maintenance/health",
    pageKey: "crm_settings.maintenance.health",
    icon: Activity,
    status: "restricted",
  },
  {
    id: "nextcloud",
    section: "maintenance",
    title: "File Manager",
    description: "Nextcloud, storage e configurazione documentale",
    href: "/crm-settings/maintenance/file-manager",
    pageKey: "crm_settings.file_manager",
    icon: FileCog,
    status: "restricted",
  },
]

export const CRM_SETTINGS_PAGE_TITLES = Object.fromEntries(
  CRM_SETTINGS_CATALOG.map((item) => [item.href, item.title]),
)

export function crmSettingsItemForPath(pathname: string) {
  return CRM_SETTINGS_CATALOG.find((item) => item.href === pathname)
}
