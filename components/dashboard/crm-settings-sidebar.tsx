"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Building2,
  Shield,
  Mail,
  PlugZap,
  SlidersHorizontal,
  Wrench,
  X,
  ChevronRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { useCrmSettingsNavigation } from "@/components/dashboard/crm-settings-navigation"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"
import {
  CRM_SETTINGS_CATALOG,
} from "@/lib/crm-settings/catalog"

type Layer =
  | "root"
  | "account-security"
  | "company"
  | "communication"
  | "crm-config"
  | "integrations"
  | "maintenance"
  | "system"

interface RootBlock {
  icon: LucideIcon
  title: string
  description: string
  layer: Exclude<Layer, "root">
}

interface SubBlock {
  icon: LucideIcon
  title: string
  description: string
  href: string
  status?: "active" | "restricted"
}

const ROOT_BLOCKS: RootBlock[] = [
  {
    icon: Shield,
    title: "Account e accessi",
    description: "Utenti, ruoli, sessioni e audit",
    layer: "account-security",
  },
  {
    icon: Building2,
    title: "Azienda",
    description: "Identita', logo, sedi e preferenze CRM",
    layer: "company",
  },
  {
    icon: Mail,
    title: "Comunicazioni",
    description: "Mail server, WhatsApp, centralino e canali",
    layer: "communication",
  },
  {
    icon: SlidersHorizontal,
    title: "Configurazione CRM",
    description: "Campi, valori, regole e flussi operativi",
    layer: "crm-config",
  },
  {
    icon: PlugZap,
    title: "Integrazioni",
    description: "Make, File Manager e connettori esterni",
    layer: "integrations",
  },
  {
    icon: Wrench,
    title: "Manutenzione",
    description: "Health check, backup e controlli tecnici",
    layer: "maintenance",
  },
]

// Layer 2: i sotto-blocchi puntano alle pagine reali gia' protette dai permessi.
const ACCOUNT_SECURITY_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => item.section === "account")
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const COMPANY_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => ["company", "sites", "appearance"].includes(item.id))
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const COMMUNICATION_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => item.id === "communication")
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const CRM_CONFIG_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) =>
    ["attributes", "default-values", "assignment-rules", "workflows", "import-export"].includes(item.id),
  )
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const INTEGRATION_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => ["make", "nextcloud"].includes(item.id))
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const MAINTENANCE_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => ["health", "backup"].includes(item.id))
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

// Testata dinamica per ciascun layer.
const LAYER_HEADER: Record<
  Layer,
  { eyebrow: string; title: string; subtitle: string; breadcrumb: string | null }
> = {
  root: {
    eyebrow: "Solair CRM",
    title: "CRM Settings & Admin",
    subtitle: "Configurazione e amministrazione",
    breadcrumb: null,
  },
  "account-security": {
    eyebrow: "Persone",
    title: "Account e accessi",
    subtitle: "Utenti, ruoli, sessioni e audit",
    breadcrumb: "CRM Settings & Admin / Account e accessi",
  },
  company: {
    eyebrow: "Organizzazione",
    title: "Azienda",
    subtitle: "Identita', logo, sedi e preferenze CRM",
    breadcrumb: "CRM Settings & Admin / Azienda",
  },
  communication: {
    eyebrow: "Canali",
    title: "Comunicazioni",
    subtitle: "Mail server, telefonia e messaggistica",
    breadcrumb: "CRM Settings & Admin / Comunicazioni",
  },
  "crm-config": {
    eyebrow: "Configurazione",
    title: "Configurazione CRM",
    subtitle: "Campi, valori, regole e flussi operativi",
    breadcrumb: "CRM Settings & Admin / Configurazione CRM",
  },
  integrations: {
    eyebrow: "Connessioni",
    title: "Integrazioni",
    subtitle: "Make, File Manager e connettori esterni",
    breadcrumb: "CRM Settings & Admin / Integrazioni",
  },
  maintenance: {
    eyebrow: "Tecnico",
    title: "Manutenzione",
    subtitle: "Health check, backup e controlli tecnici",
    breadcrumb: "CRM Settings & Admin / Manutenzione",
  },
  system: {
    eyebrow: "Organizzazione",
    title: "Azienda",
    subtitle: "Identita', logo, sedi e preferenze CRM",
    breadcrumb: "CRM Settings & Admin / Azienda",
  },
}

/** Rileva il breakpoint mobile per scegliere la direzione dello slide. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return isMobile
}

function rootBlockMeta(layer: Exclude<Layer, "root">) {
  const meta: Record<Exclude<Layer, "root">, string> = {
    "account-security": "Governance",
    company: "Profilo azienda",
    communication: "Canali operativi",
    "crm-config": "Moduli e processi",
    integrations: "Connettori",
    maintenance: "Solo tecnico",
    system: "Profilo azienda",
  }
  return meta[layer]
}

/** Card visiva condivisa tra Layer 1 e Layer 2. */
function SettingsCard({
  icon: Icon,
  title,
  description,
  status,
  meta,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  status?: "active" | "restricted"
  meta?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[104px] w-full items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-[#55C2A4]/70 hover:bg-white/[0.075] hover:shadow-[0_22px_70px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55C2A4]"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#55C2A4]/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#55C2A4]/20 bg-[#2E8B72]/16 text-[#67D9BA] shadow-[0_0_32px_rgba(46,139,114,0.14)]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-black leading-tight text-white">
            {title}
          </h3>
          {status === "restricted" ? (
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
              Riservato
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">{description}</p>
        {meta ? (
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#55C2A4]/80">
            {meta}
          </p>
        ) : null}
      </div>
      <ChevronRight className="size-5 shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
    </button>
  )
}

export function CrmSettingsSidebar() {
  const { open, closeLauncher, layer, setLayer } = useCrmSettingsLauncher()
  const { navigate, markNavigating } = useCrmSettingsNavigation()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // ESC per chiudere + blocco dello scroll della pagina sottostante.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLauncher()
        return
      }
      // Focus trap: mantiene il Tab dentro il pannello.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
    }
  }, [open, closeLauncher])

  function handleNavigate(href: string) {
    markNavigating(href)
    closeLauncher()
    navigate(href)
  }

  const panelInitial = isMobile ? { y: "100%" } : { x: "100%" }
  const panelAnimate = isMobile ? { y: 0 } : { x: 0 }
  const header = LAYER_HEADER[layer]
  const isRoot = layer === "root"
  const canSeeBlock = (block: SubBlock) => {
    const page = pageKeyFromPath(block.href)
    return page ? permissions.canPage(page) : true
  }
  const visibleAccountBlocks = ACCOUNT_SECURITY_BLOCKS.filter(canSeeBlock)
  const visibleCompanyBlocks = COMPANY_BLOCKS.filter(canSeeBlock)
  const visibleCommunicationBlocks = COMMUNICATION_BLOCKS.filter(canSeeBlock)
  const visibleCrmConfigBlocks = CRM_CONFIG_BLOCKS.filter(canSeeBlock)
  const visibleIntegrationBlocks = INTEGRATION_BLOCKS.filter(canSeeBlock)
  const visibleMaintenanceBlocks = permissions.isSuperadmin
    ? MAINTENANCE_BLOCKS.filter(canSeeBlock)
    : []
  const visibleRootBlocks = ROOT_BLOCKS.filter((block) => {
    if (block.layer === "account-security") return visibleAccountBlocks.length > 0
    if (block.layer === "company") return visibleCompanyBlocks.length > 0
    if (block.layer === "communication") return visibleCommunicationBlocks.length > 0
    if (block.layer === "crm-config") return visibleCrmConfigBlocks.length > 0
    if (block.layer === "integrations") return visibleIntegrationBlocks.length > 0
    if (block.layer === "maintenance") return visibleMaintenanceBlocks.length > 0
    if (block.layer === "system") return visibleCompanyBlocks.length > 0
    return true
  })

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          {/* Overlay scuro */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeLauncher}
            aria-hidden="true"
          />

          {/* Pannello */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Impostazioni CRM"
            className={cn(
              "absolute flex flex-col overflow-hidden border-t-2 border-t-[#2E8B72] bg-[#0B1620] shadow-[-24px_0_80px_rgba(0,0,0,0.55)] inset-x-0 bottom-0 h-[92vh] rounded-t-3xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:rounded-none",
              "md:w-[640px]",
            )}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="relative border-b border-white/8 px-7 pb-5 pt-7">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(85,194,164,0.18),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(49,95,197,0.16),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-2">
                {!isRoot ? (
                  <button
                    type="button"
                    onClick={() => setLayer("root")}
                    aria-label="Torna alle impostazioni"
                    className="-ml-1 mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55C2A4]"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[#55C2A4]">
                    {header.eyebrow}
                  </span>
                  <h2 className="text-3xl font-black leading-tight text-white">
                    {header.title}
                  </h2>
                  <p className="text-base font-medium text-gray-400">{header.subtitle}</p>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeLauncher}
                aria-label="Chiudi impostazioni"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#55C2A4]/45 bg-[#102631] text-gray-300 transition-colors hover:bg-[#163542] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55C2A4]"
              >
                <X className="size-6" />
              </button>
              </div>
            </div>

            {/* Breadcrumb (solo Layer 2) */}
            {header.breadcrumb ? (
              <div className="px-7 py-3">
                <span className="text-xs font-semibold text-gray-500">
                  {header.breadcrumb}
                </span>
              </div>
            ) : null}

            {/* Contenuto animato per layer */}
            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={layer}
                  className={cn(
                    "grid h-full content-start gap-4 overflow-y-auto px-7 pb-5",
                    isRoot ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
                  )}
                  initial={{ x: isRoot ? "-100%" : "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: isRoot ? "100%" : "-100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 260 }}
                >
                  {layer === "root"
                    ? visibleRootBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={undefined}
                          meta={rootBlockMeta(block.layer)}
                          onClick={() => setLayer(block.layer)}
                        />
                      ))
                    : null}

                  {layer === "account-security"
                    ? visibleAccountBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "maintenance"
                    ? visibleMaintenanceBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "company" || layer === "system"
                    ? visibleCompanyBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "communication"
                    ? visibleCommunicationBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "crm-config"
                    ? visibleCrmConfigBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "integrations"
                    ? visibleIntegrationBlocks.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          status={block.status}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer fisso in tutti i layer */}
            <div className="border-t border-white/10 px-7 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  Solair CRM v1.0
                </span>
                <span className="text-xs text-gray-500">
                  Powered by Mostag Studio
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
