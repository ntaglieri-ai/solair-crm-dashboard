"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Shield,
  Settings2,
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

type Layer = "root" | "account-security" | "maintenance" | "system"

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
    title: "Account & Sicurezza",
    description: "Utenti, ruoli, permessi e audit log",
    layer: "account-security",
  },
  {
    icon: Settings2,
    title: "Azienda e sistema",
    description: "Informazioni, sedi e aspetto personale",
    layer: "system",
  },
  {
    icon: Wrench,
    title: "Manutenzione",
    description: "Integrazioni, health check e File Manager",
    layer: "maintenance",
  },
]

// Layer 2 — Account & Security: i sotto-blocchi puntano alle sezioni reali
// della pagina /impostazioni tramite deep-link ?section=<id>.
const ACCOUNT_SECURITY_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => item.section === "account")
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const SYSTEM_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => item.section === "organization")
  .map((item) => ({
    icon: item.icon,
    title: item.title,
    description: item.description,
    href: item.href,
    status: item.status,
  }))

const MAINTENANCE_BLOCKS: SubBlock[] = CRM_SETTINGS_CATALOG
  .filter((item) => item.section === "maintenance")
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
    eyebrow: "Account & Security",
    title: "Gestione accessi",
    subtitle: "Configura utenti, permessi e sicurezza",
    breadcrumb: "Impostazioni › Account & Sicurezza",
  },
  maintenance: {
    eyebrow: "Amministrazione",
    title: "Manutenzione",
    subtitle: "Integrazioni, servizi e controlli tecnici",
    breadcrumb: "CRM Settings & Admin › Manutenzione",
  },
  system: {
    eyebrow: "Organizzazione",
    title: "Azienda e sistema",
    subtitle: "Informazioni, sedi e aspetto personale",
    breadcrumb: "CRM Settings & Admin › Azienda e sistema",
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

/** Card visiva condivisa tra Layer 1 e Layer 2. */
function SettingsCard({
  icon: Icon,
  title,
  description,
  status,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  status?: "active" | "restricted"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-24 w-full items-center gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 text-left transition-colors hover:border-[#2E8B72]/70 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B72]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#2E8B72]/15 text-[#55C2A4]">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold leading-tight text-white">
            {title}
          </h3>
          {status === "restricted" ? (
            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
              Riservato
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
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
  // Solo "Impostazioni di sistema" usa il pannello a metà schermo con griglia
  // multi-colonna; gli altri layer restano nel pannello stretto a colonna singola.
  const canSeeBlock = (block: SubBlock) => {
    const page = pageKeyFromPath(block.href)
    return page ? permissions.canPage(page) : true
  }
  const visibleAccountBlocks = ACCOUNT_SECURITY_BLOCKS.filter(canSeeBlock)
  const visibleSystemBlocks = SYSTEM_BLOCKS.filter(canSeeBlock)
  const visibleMaintenanceBlocks = permissions.isSuperadmin
    ? MAINTENANCE_BLOCKS.filter(canSeeBlock)
    : []
  const visibleRootBlocks = ROOT_BLOCKS.filter((block) => {
    if (block.layer === "account-security") return visibleAccountBlocks.length > 0
    if (block.layer === "system") return visibleSystemBlocks.length > 0
    if (block.layer === "maintenance") return visibleMaintenanceBlocks.length > 0
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
              "absolute flex flex-col overflow-hidden bg-[#0F1923] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] border-t-2 border-t-[#2E8B72] inset-x-0 bottom-0 h-[90vh] rounded-t-2xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:rounded-none",
              "md:w-[520px]",
            )}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
              <div className="flex min-w-0 items-start gap-2">
                {!isRoot ? (
                  <button
                    type="button"
                    onClick={() => setLayer("root")}
                    aria-label="Torna alle impostazioni"
                    className="-ml-1 mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B72]"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2E8B72]">
                    {header.eyebrow}
                  </span>
                  <h2 className="text-2xl font-bold leading-tight text-white">
                    {header.title}
                  </h2>
                  <p className="text-sm text-gray-400">{header.subtitle}</p>
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={closeLauncher}
                aria-label="Chiudi impostazioni"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B72]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Breadcrumb (solo Layer 2) */}
            {header.breadcrumb ? (
              <div className="px-6 pb-3">
                <span className="text-xs text-gray-500">
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
                    "grid h-full grid-cols-1 content-start gap-4 overflow-y-auto px-6 pb-4",
                    "grid-cols-1",
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

                  {layer === "system"
                    ? visibleSystemBlocks.map((block) => (
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
            <div className="border-t border-white/10 px-6 py-4">
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
