"use client"

import { useCallback, useEffect, useRef } from "react"
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

const HANDOFF_DELAY_MS = 1200

export function NextcloudSessionBridgeClient({
  logoutUrl,
  continueUrl,
}: {
  logoutUrl: string
  continueUrl: string
}) {
  const redirectedRef = useRef(false)

  const continueToNextcloud = useCallback(() => {
    if (redirectedRef.current) return
    redirectedRef.current = true
    window.location.replace(continueUrl)
  }, [continueUrl])

  useEffect(() => {
    void fetch(logoutUrl, {
      mode: "no-cors",
      credentials: "include",
      cache: "no-store",
    }).catch(() => null)
    const timer = window.setTimeout(continueToNextcloud, HANDOFF_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [continueToNextcloud, logoutUrl])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f2032] px-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(32,164,122,0.28),transparent_34%),linear-gradient(135deg,#0f2032_0%,#132d46_48%,#eef3f8_145%)]" />
      <iframe
        title="Chiusura sessione Nextcloud precedente"
        src={logoutUrl}
        className="pointer-events-none absolute size-px border-0 opacity-0"
        aria-hidden="true"
      />

      <section className="relative z-10 w-full max-w-md rounded-xl border border-white/15 bg-white/10 p-7 text-center shadow-[0_28px_90px_rgba(0,0,0,0.26)] backdrop-blur">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-white/12 text-[#93f0d0]">
          <ShieldCheck className="size-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#93f0d0]">
          Solair Document Cloud
        </p>
        <h1 className="mt-3 text-2xl font-bold">Preparazione accesso Nextcloud</h1>
        <p className="mt-3 text-sm leading-6 text-white/74">
          Sto chiudendo eventuali sessioni Nextcloud precedenti su questo browser.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-white/82">
          <Loader2 className="size-4 animate-spin" />
          Accesso in corso...
        </div>
        <Button
          type="button"
          onClick={continueToNextcloud}
          className="mt-6 w-full bg-white text-[#1e3a5f] hover:bg-white/90"
        >
          Continua ora
          <ArrowRight className="size-4" />
        </Button>
      </section>
    </main>
  )
}
