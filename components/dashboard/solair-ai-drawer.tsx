"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronRight, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSolairAiLauncher } from "@/lib/solair-ai-launcher"
import { useSolairAiChatLauncher } from "@/lib/solair-ai-chat-launcher"
import { useCrmSettingsNavigation } from "@/components/dashboard/crm-settings-navigation"
import { SOLAIR_AI_APPS } from "@/app/(dashboard)/solair-ai/apps"

/**
 * Stesso guscio visivo di CrmSettingsSidebar (pannello scuro, card, header,
 * footer): e' il linguaggio gia' stabilito per i drawer del CRM, SolairAI lo
 * segue invece di introdurne uno suo. Duplicato apposta invece di importare
 * SettingsCard da li' — quel file resta intoccato.
 */
function AppCard({
  app,
  onClick,
}: {
  app: (typeof SOLAIR_AI_APPS)[number]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[110px] w-full min-w-0 items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-[#55C2A4]/70 hover:bg-white/[0.075] hover:shadow-[0_22px_70px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#55C2A4] sm:items-center sm:gap-[17px] sm:p-[17px]"
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#55C2A4]/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span
        className={cn(
          "flex size-[51px] shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br text-white",
          app.tone,
          app.glow,
        )}
      >
        <Sparkles className="size-[21px]" />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <h3 className="min-w-0 break-words text-[15px] font-black leading-tight text-white sm:text-base">
          {app.nome}
        </h3>
        <p className="mt-1 min-w-0 break-words text-sm leading-relaxed text-gray-400 sm:text-[15px]">
          {app.descrizione}
        </p>
        <p className="mt-2 min-w-0 break-words text-[12px] font-bold uppercase tracking-[0.14em] text-[#55C2A4]/80">
          {app.meta}
        </p>
      </div>
      <ChevronRight className="size-[21px] shrink-0 text-gray-500 transition-transform group-hover:translate-x-1 group-hover:text-white" />
    </button>
  )
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

export function SolairAiDrawer() {
  const { open, closeSolairAi } = useSolairAiLauncher()
  const { openChat } = useSolairAiChatLauncher()
  const { navigate, markNavigating } = useCrmSettingsNavigation()
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSolairAi()
        return
      }
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
  }, [open, closeSolairAi])

  function handleNavigate(href: string) {
    markNavigating(href)
    closeSolairAi()
    navigate(href)
  }

  function handleAppClick(app: (typeof SOLAIR_AI_APPS)[number]) {
    if (app.kind === "popup") {
      closeSolairAi()
      openChat()
      return
    }
    handleNavigate(`/solair-ai/${app.slug}`)
  }

  const panelInitial = isMobile ? { y: "100%" } : { x: "100%" }
  const panelAnimate = isMobile ? { y: 0 } : { x: 0 }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeSolairAi}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="SolairAI"
            className={cn(
              "absolute flex min-w-0 flex-col overflow-hidden border-t-2 border-t-[#2E8B72] bg-[#0B1620] shadow-[-24px_0_80px_rgba(0,0,0,0.55)] inset-x-0 bottom-0 h-[92vh] rounded-t-3xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:rounded-none",
              "md:w-[min(720px,calc(100vw-248px))]",
            )}
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="relative border-b border-white/8 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-7 md:px-7">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(85,194,164,0.18),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(49,95,197,0.16),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[#55C2A4]">
                    Solair CRM
                  </span>
                  <h2 className="break-words text-2xl font-black leading-tight text-white sm:text-3xl">
                    SolairAI
                  </h2>
                  <p className="break-words text-sm font-medium text-gray-400 sm:text-base">
                    Le app basate su AI del CRM
                  </p>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={closeSolairAi}
                  aria-label="Chiudi SolairAI"
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#55C2A4]/45 bg-[#102631] text-gray-300 transition-colors hover:bg-[#163542] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55C2A4]"
                >
                  <X className="size-6" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden">
              <div className="grid h-full min-w-0 content-start gap-4 overflow-y-auto px-4 pb-5 pt-1 sm:px-6 md:px-7 xl:grid-cols-2">
                {SOLAIR_AI_APPS.map((app) => (
                  <AppCard
                    key={app.slug}
                    app={app}
                    onClick={() => handleAppClick(app)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 px-4 py-4 sm:px-6 md:px-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-300">Solair CRM v1.0</span>
                <span className="text-xs text-gray-500">Powered by Mostag Studio</span>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
