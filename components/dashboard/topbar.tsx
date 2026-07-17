"use client"

import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"

const OGGI = new Date().toLocaleDateString("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

const SECTION_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/leads", title: "Lead" },
  { prefix: "/clienti", title: "Clienti" },
  { prefix: "/compiti", title: "Compiti" },
  { prefix: "/scadenze", title: "Scadenze" },
  { prefix: "/documenti", title: "Documenti" },
  { prefix: "/installatori", title: "Installatori" },
  { prefix: "/impostazioni", title: "Impostazioni" },
]

const DEFAULT_COMPANY_LOGO = "/solair-brand-logo.png"

function getSectionTitle(pathname: string) {
  const match = SECTION_TITLES.find((s) => pathname.startsWith(s.prefix))
  return match?.title ?? "Dashboard"
}

export function Topbar() {
  const pathname = usePathname()
  const title = getSectionTitle(pathname)
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {/* Titolo + breadcrumb */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span className="flex h-6 w-12 items-center justify-start overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEFAULT_COMPANY_LOGO} alt="Solair CRM" className="h-5 w-11 object-contain object-left" />
            </span>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{title}</span>
          </nav>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">{title}</h1>
            <span className="hidden text-xs capitalize text-muted-foreground sm:inline">
              {OGGI}
            </span>
          </div>
        </div>

      </div>
    </header>
  )
}
