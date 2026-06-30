"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Shield,
  FolderOpen,
  Settings2,
  X,
  ChevronRight,
  ChevronLeft,
  Users,
  ClipboardList,
  Lock,
  Cloud,
  FolderTree,
  ShieldCheck,
  Building2,
  ListFilter,
  GitBranch,
  Webhook,
  Zap,
  ArrowLeftRight,
  DatabaseBackup,
  type LucideIcon,
} from "lucide-react"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { useCrmSettingsNavigation } from "@/components/dashboard/crm-settings-navigation"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"

type Layer = "root" | "account-security" | "file-manager" | "system"

interface RootBlock {
  icon: LucideIcon
  title: string
  description: string
  image: string
  layer: Exclude<Layer, "root">
}

interface SubBlock {
  icon: LucideIcon
  title: string
  description: string
  href: string
  image: string
}

const ROOT_BLOCKS: RootBlock[] = [
  {
    icon: Shield,
    title: "Account & Sicurezza",
    description: "Utenti, ruoli, permessi e audit log",
    image: "/crm-settings/account-security.png",
    layer: "account-security",
  },
  {
    icon: FolderOpen,
    title: "File Manager",
    description: "Storage Nextcloud, cartelle e accessi",
    image: "/crm-settings/file-manager.png",
    layer: "file-manager",
  },
  {
    icon: Settings2,
    title: "Impostazioni di sistema",
    description: "Sedi, attributi, valori e regole",
    image: "/crm-settings/system-settings.png",
    layer: "system",
  },
]

// Layer 2 — Account & Security: i sotto-blocchi puntano alle sezioni reali
// della pagina /impostazioni tramite deep-link ?section=<id>.
const ACCOUNT_SECURITY_BLOCKS: SubBlock[] = [
  {
    icon: Users,
    title: "Account Management",
    description: "Utenti, ruoli e sedi assegnate",
    href: "/crm-settings/account/utenti",
    image:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80",
  },
  {
    icon: Shield,
    title: "Permission Management",
    description: "Permessi per ruolo su pagine, record e cartelle",
    href: "/crm-settings/account/permessi",
    image:
      "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&q=80",
  },
  {
    icon: ClipboardList,
    title: "Audit & Log",
    description: "Storico accessi, modifiche e login falliti",
    href: "/crm-settings/account/audit",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  },
  {
    icon: Lock,
    title: "Session & Access",
    description: "Timeout, 2FA e dispositivi autorizzati",
    href: "/crm-settings/account/session",
    image:
      "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=800&q=80",
  },
]

// Layer 2 — File Manager: sotto-blocchi che puntano alle route reali.
const FILE_MANAGER_BLOCKS: SubBlock[] = [
  {
    icon: Cloud,
    title: "Configurazione Nextcloud",
    description: "Connessione istanza e account di servizio",
    href: "/crm-settings/file-manager/nextcloud",
    image:
      "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
  },
  {
    icon: FolderTree,
    title: "Struttura cartelle",
    description: "Template di percorso per i moduli CRM",
    href: "/crm-settings/file-manager/struttura",
    image:
      "https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=800&q=80",
  },
  {
    icon: ShieldCheck,
    title: "Permessi storage",
    description: "Cosa può fare ogni ruolo sullo storage",
    href: "/crm-settings/file-manager/permessi",
    image:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&q=80",
  },
  {
    icon: FolderOpen,
    title: "Cartelle condivise",
    description: "Cartelle accessibili a più utenti per ruolo",
    href: "/crm-settings/file-manager/condivise",
    image:
      "https://images.unsplash.com/photo-1568667256549-094345857637?w=800&q=80",
  },
]

// Layer 2 — System Settings: sotto-blocchi verso le route reali.
const SYSTEM_BLOCKS: SubBlock[] = [
  {
    icon: Building2,
    title: "Sedi",
    description: "Sedi operative assegnabili agli utenti",
    href: "/crm-settings/system/sedi",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
  },
  {
    icon: Settings2,
    title: "Attributi record",
    description: "Campi personalizzati per ogni modulo",
    href: "/crm-settings/system/attributi",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
  },
  {
    icon: ListFilter,
    title: "Valori configurabili",
    description: "Valori delle select per modulo e campo",
    href: "/crm-settings/system/valori",
    image:
      "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=80",
  },
  {
    icon: GitBranch,
    title: "Regole di assegnazione",
    description: "Assegnazione automatica dei lead",
    href: "/crm-settings/system/regole",
    image:
      "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&q=80",
  },
  {
    icon: Zap,
    title: "Flussi di lavoro",
    description: "Trigger automatici sugli eventi del CRM",
    href: "/crm-settings/system/flussi",
    image:
      "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80",
  },
  {
    icon: ArrowLeftRight,
    title: "Import / Export",
    description: "Importa ed esporta dati in CSV",
    href: "/crm-settings/system/import-export",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  },
  {
    icon: Webhook,
    title: "Integrazione Make",
    description: "Webhook Make.com collegati al CRM",
    href: "/crm-settings/system/make",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  },
  {
    icon: DatabaseBackup,
    title: "Backup",
    description: "Backup manuali del database CRM",
    href: "/crm-settings/system/backup",
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
  },
]

// Testata dinamica per ciascun layer.
const LAYER_HEADER: Record<
  Layer,
  { eyebrow: string; title: string; subtitle: string; breadcrumb: string | null }
> = {
  root: {
    eyebrow: "Solair CRM",
    title: "Impostazioni",
    subtitle: "Gestisci il tuo CRM",
    breadcrumb: null,
  },
  "account-security": {
    eyebrow: "Account & Security",
    title: "Gestione accessi",
    subtitle: "Configura utenti, permessi e sicurezza",
    breadcrumb: "Impostazioni › Account & Sicurezza",
  },
  "file-manager": {
    eyebrow: "File Manager",
    title: "Archiviazione",
    subtitle: "Storage Nextcloud, cartelle e accessi",
    breadcrumb: "Impostazioni › File Manager",
  },
  system: {
    eyebrow: "System Settings",
    title: "Configurazione sistema",
    subtitle: "Sedi, attributi, valori e regole",
    breadcrumb: "Impostazioni › Impostazioni di sistema",
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
  image,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  image: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-40 w-full overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-200 hover:scale-[1.01] hover:border-[#2E8B72] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B72]"
    >
      <img
        src={image || "/placeholder.svg"}
        alt=""
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:brightness-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
        <div className="flex flex-col gap-1">
          <Icon className="mb-1 size-6 text-[#2E8B72]" />
          <h3 className="text-lg font-semibold leading-tight text-white">
            {title}
          </h3>
          <p className="text-sm text-gray-300">{description}</p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
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
  const isSystem = layer === "system"
  const canSeeBlock = (block: SubBlock) => {
    const page = pageKeyFromPath(block.href)
    return page ? permissions.canPage(page) : true
  }
  const visibleAccountBlocks = ACCOUNT_SECURITY_BLOCKS.filter(canSeeBlock)
  const visibleSystemBlocks = SYSTEM_BLOCKS.filter(canSeeBlock)
  const visibleRootBlocks = ROOT_BLOCKS.filter((block) => {
    if (block.layer === "account-security") return visibleAccountBlocks.length > 0
    if (block.layer === "system") return visibleSystemBlocks.length > 0
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
              isSystem ? "md:w-1/2 md:min-w-[520px]" : "md:w-[480px]",
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
                    isSystem && "sm:grid-cols-2 xl:grid-cols-3",
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
                          image={block.image}
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
                          image={block.image}
                          onClick={() => handleNavigate(block.href)}
                        />
                      ))
                    : null}

                  {layer === "file-manager"
                    ? FILE_MANAGER_BLOCKS.map((block) => (
                        <SettingsCard
                          key={block.title}
                          icon={block.icon}
                          title={block.title}
                          description={block.description}
                          image={block.image}
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
                          image={block.image}
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
