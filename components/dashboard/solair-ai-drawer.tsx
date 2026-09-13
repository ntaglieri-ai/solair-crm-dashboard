"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useSolairAiLauncher } from "@/lib/solair-ai-launcher"
import { SOLAIR_AI_APPS } from "@/app/(dashboard)/solair-ai/apps"

const COLORI_TILE = ["bg-navy", "bg-teal", "bg-[#8a5cf6]", "bg-[#c2410c]"]

/**
 * Skyline stilizzata per l'hero del drawer: non e' una foto (niente
 * questioni di diritti su un edificio reale), ma la stessa idea — grattacieli
 * a vetri di sera, silhouette su un verde smeraldo profondo.
 */
function SkylineHero() {
  const palazzi = [
    { x: 0, w: 34, h: 90, o: 0.14 },
    { x: 36, w: 46, h: 140, o: 0.22 },
    { x: 86, w: 30, h: 100, o: 0.16 },
    { x: 120, w: 58, h: 190, o: 0.3, torre: true },
    { x: 182, w: 34, h: 120, o: 0.18 },
    { x: 220, w: 44, h: 80, o: 0.13 },
    { x: 268, w: 52, h: 150, o: 0.24 },
    { x: 324, w: 30, h: 95, o: 0.15 },
  ]
  return (
    <svg
      viewBox="0 0 360 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {palazzi.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={200 - p.h}
          width={p.w}
          height={p.h}
          fill="#eafff4"
          fillOpacity={p.o}
        />
      ))}
      {/* Griglia a vetri sulla torre piu' alta, quella "premium" */}
      {Array.from({ length: 9 }).map((_, row) =>
        Array.from({ length: 5 }).map((_, col) => (
          <rect
            key={`w-${row}-${col}`}
            x={126 + col * 10}
            y={16 + row * 17}
            width={6}
            height={10}
            fill="#eafff4"
            fillOpacity={(row + col) % 3 === 0 ? 0.5 : 0.2}
          />
        )),
      )}
    </svg>
  )
}

export function SolairAiDrawer() {
  const { open, closeSolairAi } = useSolairAiLauncher()

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeSolairAi()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full border-l-0 bg-[#f3f2f2] p-0 sm:max-w-none sm:w-[680px] lg:w-[800px]"
      >
        <button
          type="button"
          onClick={closeSolairAi}
          aria-label="Chiudi"
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/15 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/25 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex h-full flex-col overflow-y-auto">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0c3b2e] via-[#145c46] to-[#1e3a5f] px-8 py-10">
            <SkylineHero />
            <div className="relative">
              <span className="mb-3 inline-flex size-11 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm">
                <Sparkles className="size-5" />
              </span>
              <SheetTitle className="font-heading text-[28px] font-semibold text-white">
                SolairAI
              </SheetTitle>
              <SheetDescription className="mt-1 max-w-sm text-[15px] text-[#c7ecdd]">
                Le app basate su AI del CRM, in un unico posto.
              </SheetDescription>
            </div>
          </div>

          <div className="flex-1 px-6 py-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              App disponibili
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SOLAIR_AI_APPS.map((app, i) => (
                <Link
                  key={app.slug}
                  href={`/solair-ai/${app.slug}`}
                  title={app.descrizione}
                  onClick={closeSolairAi}
                  className="group flex flex-col items-center gap-2 rounded-md border border-[#dddbda] bg-white px-3 py-5 text-center transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                >
                  <span
                    className={`flex size-11 items-center justify-center rounded-lg text-white ${COLORI_TILE[i % COLORI_TILE.length]}`}
                  >
                    <Sparkles className="size-5" />
                  </span>
                  <span className="text-[13px] font-medium leading-tight text-[#032d60] group-hover:underline">
                    {app.nome}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
