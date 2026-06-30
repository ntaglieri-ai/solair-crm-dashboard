"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  Shield,
  FolderOpen,
  Zap,
  ClipboardList,
  Building2,
  Settings2,
  ListFilter,
  ChevronRight,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CURRENT_USER } from "@/lib/mock-data"
import { UtentiSection } from "@/components/impostazioni/utenti-section"
import { RuoliSection } from "@/components/impostazioni/ruoli-section"
import { PlaceholderSection } from "@/components/impostazioni/placeholder-section"

type SectionId =
  | "utenti"
  | "ruoli"
  | "file-manager"
  | "make"
  | "audit"
  | "sedi"
  | "attributi"
  | "valori"
  | "regole"

interface SectionDef {
  id: SectionId
  label: string
  icon: LucideIcon
}

const ADMIN_SECTIONS: SectionDef[] = [
  { id: "utenti", label: "Utenti", icon: Users },
  { id: "ruoli", label: "Ruoli e permessi", icon: Shield },
  { id: "file-manager", label: "File manager", icon: FolderOpen },
  { id: "make", label: "Integrazione Make", icon: Zap },
  { id: "audit", label: "Audit log", icon: ClipboardList },
]

const GENERAL_SECTIONS: SectionDef[] = [
  { id: "sedi", label: "Sedi", icon: Building2 },
  { id: "attributi", label: "Campi personalizzati", icon: Settings2 },
  { id: "valori", label: "Valori predefiniti", icon: Settings2 },
  { id: "regole", label: "Regole di assegnazione", icon: ListFilter },
]

function NavGroup({
  title,
  sections,
  active,
  onSelect,
}: {
  title: string
  sections: SectionDef[]
  active: SectionId
  onSelect: (id: SectionId) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {sections.map((s) => {
        const Icon = s.icon
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-r-lg border-l-2 px-2.5 py-2 text-left text-sm font-medium transition-colors",
              isActive
                ? "border-teal bg-teal/8 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn("size-[18px] shrink-0", isActive && "text-teal")}
            />
            <span className="flex-1 truncate">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function CrmSettingsPage() {
  const router = useRouter()
  const isAdmin = CURRENT_USER.ruoloKey === "admin"
  const [active, setActive] = useState<SectionId>("utenti")

  // Protezione visuale: i non-admin vengono rimandati alla dashboard.
  useEffect(() => {
    if (!isAdmin) router.replace("/")
  }, [isAdmin, router])

  // Deep-link da CRM Settings launcher: ?section=<id> seleziona la sezione.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("section")
    const valid: SectionId[] = [
      "utenti",
      "ruoli",
      "file-manager",
      "make",
      "audit",
      "sedi",
      "attributi",
      "valori",
      "regole",
    ]
    if (param && valid.includes(param as SectionId)) {
      setActive(param as SectionId)
    }
  }, [])

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Accesso riservato agli amministratori. Reindirizzamento in corso…
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <span>Solair CRM</span>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">CRM Settings</span>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CRM Settings
          </h1>
          <span className="inline-flex h-5 items-center rounded-full bg-destructive/10 px-2 text-xs font-semibold text-destructive">
            Solo admin
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Navigazione sezioni */}
        <aside className="lg:w-[240px] lg:shrink-0">
          <div className="flex flex-col gap-5 lg:sticky lg:top-6">
            <NavGroup
              title="Administrative & Security"
              sections={ADMIN_SECTIONS}
              active={active}
              onSelect={setActive}
            />
            <NavGroup
              title="General Settings"
              sections={GENERAL_SECTIONS}
              active={active}
              onSelect={setActive}
            />
          </div>
        </aside>

        {/* Contenuto sezione */}
        <section className="min-w-0 flex-1">
          {active === "utenti" && <UtentiSection />}
          {active === "ruoli" && <RuoliSection />}
          {active === "file-manager" && (
            <PlaceholderSection
              title="File manager"
              description="Collega un provider di archiviazione per sincronizzare i documenti del CRM."
              icon={FolderOpen}
            />
          )}
          {active === "make" && (
            <PlaceholderSection
              title="Integrazione Make"
              description="Automatizza i flussi di lavoro collegando il CRM a Make."
              icon={Zap}
            />
          )}
          {active === "audit" && (
            <PlaceholderSection
              title="Audit log"
              description="Traccia le azioni e le modifiche effettuate nel CRM."
              icon={ClipboardList}
            />
          )}
          {active === "sedi" && (
            <PlaceholderSection
              title="Sedi"
              description="Gestisci le sedi operative dell'azienda."
              icon={Building2}
            />
          )}
          {active === "attributi" && (
            <PlaceholderSection
              title="Campi personalizzati"
              description="Configura i campi personalizzati per lead, clienti e attività."
              icon={Settings2}
            />
          )}
          {active === "valori" && (
            <PlaceholderSection
              title="Valori predefiniti"
              description="Gestisci gli elenchi di valori usati nei menu a tendina del CRM."
              icon={Settings2}
            />
          )}
          {active === "regole" && (
            <PlaceholderSection
              title="Regole di assegnazione"
              description="Definisci come i nuovi lead vengono assegnati al team."
              icon={ListFilter}
            />
          )}
        </section>
      </div>
    </div>
  )
}
