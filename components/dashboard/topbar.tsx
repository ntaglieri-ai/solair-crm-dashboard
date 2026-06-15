"use client"

import { Search, Bell, HelpCircle, ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"
import { CURRENT_USER } from "@/lib/mock-data"

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
            <span>Solair CRM</span>
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

        {/* Azioni */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Cerca lead, clienti..."
              aria-label="Cerca lead, clienti"
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <button
            type="button"
            aria-label="Notifiche"
            className="relative flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive ring-2 ring-card" />
          </button>

          <button
            type="button"
            aria-label="Aiuto"
            className="flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="size-[18px]" />
          </button>

          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-navy-foreground">
            {CURRENT_USER.iniziali}
          </div>
        </div>
      </div>
    </header>
  )
}
