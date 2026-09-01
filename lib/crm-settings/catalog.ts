import type { LucideIcon } from "lucide-react"
import {
  Activity,
  ArrowLeftRight,
  Bot,
  Building,
  Building2,
  DatabaseBackup,
  FileCog,
  FileUp,
  KeyRound,
  ListChecks,
  Mail,
  Megaphone,
  Palette,
  PlugZap,
  Shield,
  SlidersHorizontal,
  Sparkles,
  ScrollText,
  ShieldCheck,
  UsersRound,
  Users,
  Wrench,
} from "lucide-react"

/**
 * Unica tassonomia di CRM Settings: 7 gruppi.
 * Sono gli stessi gruppi in tutti i punti di navigazione — card del drawer
 * (Layer 1 -> Layer 2), sidebar di sezione e breadcrumb — cosi' una pagina
 * non puo' finire sotto un gruppo nel breadcrumb e sotto un altro nel menu.
 */
export type CrmSettingsGroupId =
  | "account-security"
  | "ai-features"
  | "company"
  | "communication"
  | "crm-config"
  | "integrations"
  | "maintenance"

/** Il drawer ha un livello in piu' dei gruppi: la home delle impostazioni. */
export type CrmSettingsLayer = "root" | CrmSettingsGroupId

export interface CrmSettingsGroup {
  id: CrmSettingsGroupId
  /** Etichetta usata da breadcrumb, back-link e testata del drawer. */
  title: string
  description: string
  eyebrow: string
  subtitle: string
  /** Riga in maiuscoletto sotto la card di Layer 1. */
  meta: string
  icon: LucideIcon
  /**
   * Registro colore del gruppo: le pagine lo ereditano, non lo dichiarano.
   * `tone` gradiente della voce attiva, `soft` sfondo pastello a riposo,
   * `glow` ombra del badge attivo.
   */
  tone: string
  soft: string
  glow: string
}

export const CRM_SETTINGS_GROUPS: Record<CrmSettingsGroupId, CrmSettingsGroup> = {
  "account-security": {
    id: "account-security",
    title: "Admin & Sicurezza",
    description: "Utenti, ruoli, sessioni e audit",
    eyebrow: "Persone",
    subtitle: "Utenti, ruoli, sessioni e audit",
    meta: "Governance",
    icon: Shield,
    tone: "from-[#0176d3] to-[#2e8bff]",
    soft: "bg-[#0176d3]/10 text-[#0176d3]",
    glow: "shadow-[0_8px_18px_rgb(1_118_211/22%)]",
  },
  "ai-features": {
    id: "ai-features",
    title: "AI Features",
    description: "Conoscenza chatbot e funzionalità AI",
    eyebrow: "Intelligenza artificiale",
    subtitle: "RobertaBot e funzionalità AI",
    meta: "Assistente AI",
    icon: Sparkles,
    tone: "from-[#6f42c1] to-[#9f7aea]",
    soft: "bg-[#6f42c1]/10 text-[#6f42c1]",
    glow: "shadow-[0_8px_18px_rgb(111_66_193/22%)]",
  },
  company: {
    id: "company",
    title: "Azienda",
    description: "Identità, logo, sedi e preferenze CRM",
    eyebrow: "Organizzazione",
    subtitle: "Identità, logo, sedi e preferenze CRM",
    meta: "Profilo azienda",
    icon: Building2,
    tone: "from-[#2e8b72] to-[#35b79a]",
    soft: "bg-[#2e8b72]/10 text-[#2e8b72]",
    glow: "shadow-[0_8px_18px_rgb(46_139_114/22%)]",
  },
  communication: {
    id: "communication",
    title: "Comunicazioni",
    description: "Mail server, WhatsApp, centralino e canali",
    eyebrow: "Canali",
    subtitle: "Mail server, telefonia e messaggistica",
    meta: "Canali operativi",
    icon: Mail,
    tone: "from-[#0b7285] to-[#22b8cf]",
    soft: "bg-[#0b7285]/10 text-[#0b7285]",
    glow: "shadow-[0_8px_18px_rgb(11_114_133/22%)]",
  },
  "crm-config": {
    id: "crm-config",
    title: "Configurazione CRM",
    description: "Campi, valori, regole e flussi operativi",
    eyebrow: "Configurazione",
    subtitle: "Campi, valori, regole e flussi operativi",
    meta: "Moduli e processi",
    icon: SlidersHorizontal,
    tone: "from-[#4338ca] to-[#7c86ff]",
    soft: "bg-[#4338ca]/10 text-[#4338ca]",
    glow: "shadow-[0_8px_18px_rgb(67_56_202/22%)]",
  },
  integrations: {
    id: "integrations",
    title: "Integrazioni",
    description: "Make, File Manager e connettori esterni",
    eyebrow: "Connessioni",
    subtitle: "Make, File Manager e connettori esterni",
    meta: "Connettori",
    icon: PlugZap,
    tone: "from-[#dd7a01] to-[#f5b041]",
    soft: "bg-[#dd7a01]/10 text-[#b45309]",
    glow: "shadow-[0_8px_18px_rgb(221_122_1/22%)]",
  },
  maintenance: {
    id: "maintenance",
    title: "Manutenzione",
    description: "Health check, backup e controlli tecnici",
    eyebrow: "Tecnico",
    subtitle: "Health check, backup e controlli tecnici",
    meta: "Solo tecnico",
    icon: Wrench,
    tone: "from-[#475569] to-[#7c8ca3]",
    soft: "bg-[#475569]/10 text-[#475569]",
    glow: "shadow-[0_8px_18px_rgb(71_85_105/22%)]",
  },
}

/** Ordine di comparsa delle card nel Layer 1 del drawer. */
export const CRM_SETTINGS_GROUP_ORDER: CrmSettingsGroupId[] = [
  "account-security",
  "ai-features",
  "company",
  "communication",
  "crm-config",
  "integrations",
  "maintenance",
]

export interface CrmSettingsCatalogItem {
  id: string
  group: CrmSettingsGroupId
  title: string
  description: string
  href: string
  pageKey: string
  icon: LucideIcon
  status?: "active" | "restricted"
}

export const CRM_SETTINGS_CATALOG: CrmSettingsCatalogItem[] = [
  {
    id: "accounts",
    group: "account-security",
    title: "Utenti e account",
    description: "Utenti, ruoli e sedi assegnate",
    href: "/crm-settings/account/utenti",
    pageKey: "crm_settings.account.utenti",
    icon: Users,
    status: "active",
  },
  {
    id: "permissions",
    group: "account-security",
    title: "Ruoli e permessi",
    description: "Accessi a pagine, dati e operazioni",
    href: "/crm-settings/account/permessi",
    pageKey: "crm_settings.account.permessi",
    icon: ShieldCheck,
    status: "active",
  },
  {
    id: "teams",
    group: "account-security",
    title: "Team",
    description: "Agenti e Direttori dei gruppi operativi",
    href: "/crm-settings/account/teams",
    pageKey: "crm_settings.account",
    icon: UsersRound,
    status: "active",
  },
  {
    id: "audit",
    group: "account-security",
    title: "Audit e log",
    description: "Accessi e modifiche rilevanti",
    href: "/crm-settings/account/audit",
    pageKey: "crm_settings.account.audit",
    icon: ScrollText,
    status: "restricted",
  },
  {
    id: "sessions",
    group: "account-security",
    title: "Sessioni e sicurezza",
    description: "Sessioni, dispositivi e criteri di accesso",
    href: "/crm-settings/account/session",
    pageKey: "crm_settings.account.session",
    icon: KeyRound,
    status: "restricted",
  },
  {
    id: "roberta",
    group: "ai-features",
    title: "RobertaBot",
    description: "Stato tecnico, indicizzazione e sincronizzazione conoscenza",
    href: "/crm-settings/system/roberta",
    pageKey: "crm_settings.system.roberta",
    icon: Bot,
    status: "active",
  },
  {
    id: "company",
    group: "company",
    title: "Informazioni aziendali",
    description: "Identità, contatti e logo aziendale",
    href: "/crm-settings/system/azienda",
    pageKey: "crm_settings.system.azienda",
    icon: Building,
    status: "active",
  },
  {
    id: "sites",
    group: "company",
    title: "Sedi e territori",
    description: "Sedi operative usate da utenti e dashboard",
    href: "/crm-settings/system/sedi",
    pageKey: "crm_settings.system.sedi",
    icon: Building2,
    status: "active",
  },
  {
    id: "appearance",
    group: "company",
    title: "Aspetto personale",
    description: "Tema e preferenze salvate per il tuo account",
    href: "/crm-settings/system/aspetto",
    pageKey: "crm_settings.system.aspetto",
    icon: Palette,
    status: "active",
  },
  {
    id: "communication",
    group: "communication",
    title: "Canali e mail server",
    description: "SMTP, IMAP, centralino, WhatsApp e canali operativi",
    href: "/crm-settings/system/comunicazioni",
    pageKey: "crm_settings.system.comunicazioni",
    icon: Mail,
    status: "active",
  },
  {
    id: "attributes",
    group: "crm-config",
    title: "Campi e attributi",
    description: "Schema campi, visibilità e configurazione moduli",
    href: "/crm-settings/system/attributi",
    pageKey: "crm_settings.system.attributi",
    icon: SlidersHorizontal,
    status: "active",
  },
  {
    id: "default-values",
    group: "crm-config",
    title: "Valori predefiniti",
    description: "Liste, stati, priorità e valori configurabili",
    href: "/crm-settings/system/valori",
    pageKey: "crm_settings.system.valori",
    icon: ListChecks,
    status: "active",
  },
  {
    id: "import-export",
    group: "crm-config",
    title: "Import / Export",
    description: "Importazioni, esportazioni e migrazione dati",
    href: "/crm-settings/system/import-export",
    pageKey: "crm_settings.system.import_export",
    icon: ArrowLeftRight,
    status: "active",
  },
  {
    // Pagina temporanea del cutover Zoho: sta con Import / Export, il link che
    // la usa, per non restare fuori da ogni gruppo finche' esiste.
    id: "zoho-t0",
    group: "crm-config",
    title: "Import Zoho T0",
    description: "Dry-run e cutover manuale dei dati CRM da CSV Zoho",
    href: "/crm-settings/system/import-export/zoho-t0",
    pageKey: "crm_settings.system.zoho_t0",
    icon: FileUp,
    status: "restricted",
  },
  {
    id: "make",
    group: "integrations",
    title: "Integrazioni Make",
    description: "Sito, Meta Ads, parametri e stato connessioni",
    href: "/crm-settings/maintenance/make",
    pageKey: "crm_settings.system.make",
    icon: PlugZap,
    status: "restricted",
  },
  {
    id: "meta",
    group: "integrations",
    title: "Meta Ads",
    description: "Pagine Facebook collegate e stato webhook",
    href: "/crm-settings/maintenance/meta",
    pageKey: "crm_settings.system.meta",
    icon: Megaphone,
    status: "restricted",
  },
  {
    id: "nextcloud",
    group: "integrations",
    title: "File Manager",
    description: "Nextcloud, storage e configurazione documentale",
    href: "/crm-settings/maintenance/file-manager",
    pageKey: "crm_settings.file_manager",
    icon: FileCog,
    status: "restricted",
  },
  {
    id: "health",
    group: "maintenance",
    title: "Health check",
    description: "Stato reale dei servizi collegati al CRM",
    href: "/crm-settings/maintenance/health",
    pageKey: "crm_settings.maintenance.health",
    icon: Activity,
    status: "restricted",
  },
  {
    id: "backup",
    group: "maintenance",
    title: "Backup",
    description: "Operazioni tecniche sul database",
    href: "/crm-settings/maintenance/backup",
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

/** Le pagine di un gruppo, nell'ordine del catalogo. */
export function crmSettingsItemsForGroup(group: CrmSettingsGroupId) {
  return CRM_SETTINGS_CATALOG.filter((item) => item.group === group)
}

/** Il gruppo a cui appartiene una pagina, dedotto dal catalogo. */
export function crmSettingsGroupForPath(pathname: string): CrmSettingsGroup | null {
  const item = crmSettingsItemForPath(pathname)
  return item ? CRM_SETTINGS_GROUPS[item.group] : null
}
