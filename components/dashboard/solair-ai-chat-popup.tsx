"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Sparkles, TriangleAlert, X } from "lucide-react"

import { useSolairAiChatLauncher } from "@/lib/solair-ai-chat-launcher"
import { SolairAiClient } from "@/app/(dashboard)/solair-ai/assistente/solair-ai-client"

type StatoAI = { canRun: boolean; canReview: boolean; cartelleConfigurate: number }

export function SolairAiChatPopup() {
  const { open, closeChat } = useSolairAiChatLauncher()
  const [stato, setStato] = useState<StatoAI | null>(null)
  const [errore, setErrore] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Carica canRun/canReview/cartelleConfigurate solo al primo open: la
  // pagina /solair-ai/assistente li calcola server-side, il popup — montato
  // nel layout, fuori da quella pagina — li chiede a /api/solair-ai/stato.
  useEffect(() => {
    if (!open || stato || errore) return
    let annullato = false
    fetch("/api/solair-ai/stato")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((dati: StatoAI) => {
        if (!annullato) setStato(dati)
      })
      .catch(() => {
        if (!annullato) setErrore(true)
      })
    return () => {
      annullato = true
    }
  }, [open, stato, errore])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, closeChat])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="SolairAI"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-5 right-5 z-50 flex h-[min(680px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-[#6f42c1]/5 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#6f42c1]/10 text-[#6f42c1]">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">SolairAI</p>
              <p className="truncate text-xs text-muted-foreground">Assistente Documenti</p>
            </div>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Chiudi"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {errore ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Non riesco a caricare SolairAI. Riprova.</span>
              </div>
            ) : !stato ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <SolairAiClient
                compact
                canRun={stato.canRun}
                canReview={stato.canReview}
                cartelleConfigurate={stato.cartelleConfigurate}
              />
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
