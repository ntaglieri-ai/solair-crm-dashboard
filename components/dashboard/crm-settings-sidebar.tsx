"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  Shield,
  FolderOpen,
  Settings2,
  X,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"

interface LauncherBlock {
  icon: LucideIcon
  title: string
  description: string
  href: string
  image: string
}

const BLOCKS: LauncherBlock[] = [
  {
    icon: Shield,
    title: "Account & Sicurezza",
    description: "Utenti, ruoli, permessi e audit log",
    href: "/impostazioni?section=utenti",
    image: "/crm-settings/account-security.png",
  },
  {
    icon: FolderOpen,
    title: "File Manager",
    description: "Storage Nextcloud, cartelle e accessi",
    href: "/impostazioni?section=file-manager",
    image: "/crm-settings/file-manager.png",
  },
  {
    icon: Settings2,
    title: "Impostazioni di sistema",
    description: "Sedi, attributi, valori e regole",
    href: "/impostazioni?section=sedi",
    image: "/crm-settings/system-settings.png",
  },
]

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

export function CrmSettingsSidebar() {
  const { open, closeLauncher } = useCrmSettingsLauncher()
  const router = useRouter()
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
    // Sposta il focus sul bottone di chiusura all'apertura.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
    }
  }, [open, closeLauncher])

  function handleNavigate(href: string) {
    closeLauncher()
    router.push(href)
  }

  // Varianti di animazione: da destra su desktop, dal basso su mobile.
  const panelInitial = isMobile ? { y: "100%" } : { x: "100%" }
  const panelAnimate = isMobile ? { y: 0 } : { x: 0 }

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
            className="absolute flex flex-col bg-[#0F1923] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] border-t-2 border-t-[#2E8B72] inset-x-0 bottom-0 h-[90vh] rounded-t-2xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[480px] md:rounded-none"
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2E8B72]">
                  Solair CRM
                </span>
                <h2 className="text-2xl font-bold leading-tight text-white">
                  Impostazioni
                </h2>
                <p className="text-sm text-gray-400">Gestisci il tuo CRM</p>
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

            {/* Blocchi */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
              {BLOCKS.map((block) => {
                const Icon = block.icon
                return (
                  <button
                    key={block.title}
                    type="button"
                    onClick={() => handleNavigate(block.href)}
                    className="group relative h-40 w-full overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-200 hover:scale-[1.01] hover:border-[#2E8B72] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B72]"
                  >
                    {/* Immagine di sfondo */}
                    <img
                      src={block.image || "/placeholder.svg"}
                      alt=""
                      className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:brightness-110"
                    />
                    {/* Overlay gradiente */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                    {/* Contenuto */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                      <div className="flex flex-col gap-1">
                        <Icon className="mb-1 size-6 text-[#2E8B72]" />
                        <h3 className="text-lg font-semibold leading-tight text-white">
                          {block.title}
                        </h3>
                        <p className="text-sm text-gray-300">
                          {block.description}
                        </p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
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
