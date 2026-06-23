"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  IconUsers,
  IconFolders,
  IconPlugConnected,
  IconHistory,
  IconBuildingStore,
  IconForms,
  IconAdjustments,
  IconRouteAltLeft,
  IconChevronRight,
  type Icon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { CURRENT_USER } from "@/lib/mock-data"
import { UtentiSection } from "@/components/impostazioni/utenti-section"
import { FileManagerSection } from "@/components/impostazioni/file-manager-section"
import { MakeSection } from "@/components/impostazioni/make-section"
import { AuditLogSection } from "@/components/impostazioni/audit-log-section"
import { SediSection } from "@/components/impostazioni/sedi-section"
import { AttributiSection } from "@/components/impostazioni/attributi-section"
import { ValoriSection } from "@/components/impostazioni/valori-section"
import { RegoleSection } from "@/components/impostazioni/regole-section"

type SectionId =
  | "utenti"
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
  icon: Icon
}

const ADMIN_SECTIONS: SectionDef[] = [
  { id: "utenti", label: "Utenti e ruoli", icon: IconUsers },
  { id: "file-manager", label: "File manager", icon: IconFolders },
  { id: "make", label: "Integrazione Make", icon: IconPlugConnected },
  { id: "audit", label: "Audit log", icon: IconHistory },
]

const GENERAL_SECTIONS: SectionDef[] = [
  { id: "sedi", label: "Sedi", icon: IconBuildingStore },
  { id: "attributi", label: "Attributi record", icon: IconForms },
  { id: "valori", label: "Valori configurabili", icon: IconAdjustments },
  { id: "regole", label: "Regole di assegnazione", icon: IconRouteAltLeft },
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
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon size={18} stroke={1.8} className="shrink-0" />
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
          <IconChevronRight size={14} stroke={2} />
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
        <aside className="lg:w-[220px] lg:shrink-0">
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
          {active === "file-manager" && <FileManagerSection />}
          {active === "make" && <MakeSection />}
          {active === "audit" && <AuditLogSection />}
          {active === "sedi" && <SediSection />}
          {active === "attributi" && <AttributiSection />}
          {active === "valori" && <ValoriSection />}
          {active === "regole" && <RegoleSection />}
        </section>
      </div>
    </div>
  )
}
