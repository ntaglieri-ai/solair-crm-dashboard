"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import {
  IconTag,
  IconColumns3,
  IconAdjustmentsHorizontal,
  IconRoute,
  IconDatabaseCog,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  INSTALLATORE_COLUMNS,
  INSTALLATORE_COLUMN_GROUPS,
  DEFAULT_INSTALLATORE_COLUMNS,
  type InstallatoreColumnId,
} from "@/lib/mock-data"
import type { Density } from "./installatore-table"
import { GeneralSection } from "@/components/leads/lead-settings-sheet"
import { RulesSection } from "@/components/leads/assignment-rules"
import { InstallatoreTagSection } from "./installatore-tag-section"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

function ColumnsSection({
  visible,
  onChange,
}: {
  visible: InstallatoreColumnId[]
  onChange: (cols: InstallatoreColumnId[]) => void
}) {
  const [query, setQuery] = useState("")
  const set = new Set(visible)
  const q = query.trim().toLowerCase()

  const toggle = (id: InstallatoreColumnId) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const kept = visible.filter((v) => next.has(v))
    const added = INSTALLATORE_COLUMNS.filter(
      (c) => next.has(c.id) && !visible.includes(c.id),
    ).map((c) => c.id)
    onChange([...kept, ...added])
  }

  const groups = useMemo(
    () =>
      INSTALLATORE_COLUMN_GROUPS.map((group) => ({
        group,
        cols: INSTALLATORE_COLUMNS.filter(
          (c) =>
            c.group === group &&
            (q === "" || c.label.toLowerCase().includes(q)),
        ),
      })).filter((g) => g.cols.length > 0),
    [q],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca colonna"
          className="bg-card pl-9"
          aria-label="Cerca colonna"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {visible.length} di {INSTALLATORE_COLUMNS.length} colonne visibili
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...DEFAULT_INSTALLATORE_COLUMNS])}
        >
          Ripristina default
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna colonna trovata.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ group, cols }) => (
            <div key={group} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              {cols.map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary/60"
                >
                  <Checkbox
                    checked={set.has(col.id)}
                    onCheckedChange={() => toggle(col.id)}
                  />
                  <span className="text-foreground">{col.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export type InstallatoreSettingsSectionId =
  | "tag"
  | "regole"
  | "colonne"
  | "generali"
  | "amministrazione"

const SECTIONS: {
  id: InstallatoreSettingsSectionId
  label: string
  description: string
  icon: typeof IconTag
}[] = [
  {
    id: "generali",
    label: "Generali",
    description: "Densità tabella e impaginazione dell'elenco installatori.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    id: "colonne",
    label: "Vista colonne",
    description: "Scegli quali colonne mostrare nella tabella installatori.",
    icon: IconColumns3,
  },
  {
    id: "tag",
    label: "Tag",
    description: "Gestisci i tag: rinomina, cambia colore o elimina.",
    icon: IconTag,
  },
  {
    id: "regole",
    label: "Regole di assegnazione",
    description:
      "Assegna automaticamente i nuovi installatori ai proprietari in base a criteri.",
    icon: IconRoute,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti degli Installatori.",
    icon: IconDatabaseCog,
  },
]

export function InstallatoreSettingsSheet({
  visibleCols,
  onVisibleColsChange,
  density,
  onDensityChange,
  rowsPerPage,
  onRowsPerPageChange,
  trigger,
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  visibleCols: InstallatoreColumnId[]
  onVisibleColsChange: (cols: InstallatoreColumnId[]) => void
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: InstallatoreSettingsSectionId
  onSectionChange: (s: InstallatoreSettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Installatori</SheetTitle>
          <SheetDescription>
            Personalizza tag, colonne e visualizzazione dell&apos;elenco
            installatori.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1">
          <nav className="w-44 shrink-0 border-r border-border p-2">
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const isActive = s.id === section
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSectionChange(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon size={17} stroke={1.8} />
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {active.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {active.description}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {section === "tag" && <InstallatoreTagSection />}
              {section === "regole" && <RulesSection />}
              {section === "amministrazione" && (
                <ModuleGovernanceSection
                  module="installatori"
                  label="Installatori"
                />
              )}
              {section === "colonne" && (
                <ColumnsSection
                  visible={visibleCols}
                  onChange={onVisibleColsChange}
                />
              )}
              {section === "generali" && (
                <GeneralSection
                  density={density}
                  onDensityChange={onDensityChange}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={onRowsPerPageChange}
                  entityLabel="installatori"
                />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
