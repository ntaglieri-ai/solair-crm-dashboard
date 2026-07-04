"use client"

import {
  IconColumns3,
  IconAdjustmentsHorizontal,
  IconLayoutList,
  IconList,
  IconListDetails,
  IconDatabaseCog,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import {
  LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type LeadColumnId,
} from "@/lib/mock-data"
import type { Density } from "./lead-table"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

/* -------------------------------------------------------------------------- */
/*                           Sezione: Vista colonne                           */
/* -------------------------------------------------------------------------- */

function ColumnsSection({
  visible,
  onChange,
}: {
  visible: LeadColumnId[]
  onChange: (cols: LeadColumnId[]) => void
}) {
  const set = new Set(visible)

  const toggle = (id: LeadColumnId) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(LEAD_COLUMNS.filter((c) => next.has(c.id)).map((c) => c.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {visible.length} di {LEAD_COLUMNS.length} colonne visibili
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...DEFAULT_VISIBLE_COLUMNS])}
        >
          Ripristina default
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
        {LEAD_COLUMNS.map((col) => (
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
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Sezione: Generali                               */
/* -------------------------------------------------------------------------- */

const DENSITY_OPTIONS: {
  value: Density
  label: string
  icon: typeof IconList
}[] = [
  { value: "comoda", label: "Compatta", icon: IconLayoutList },
  { value: "normale", label: "Normale", icon: IconList },
  { value: "densa", label: "Densa", icon: IconListDetails },
]

const ROWS_OPTIONS = [10, 30, 50]

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {children}
    </div>
  )
}

export function GeneralSection({
  density,
  onDensityChange,
  rowsPerPage,
  onRowsPerPageChange,
  entityLabel = "lead",
}: {
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  entityLabel?: string
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <SettingRow
        title="Densità tabella"
        description={`Spaziatura delle righe nell'elenco ${entityLabel}.`}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {DENSITY_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = density === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-label={opt.label}
                aria-pressed={active}
                onClick={() => onDensityChange(opt.value)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors duration-150",
                  active
                    ? "border border-navy bg-[#EEF2FF] text-navy"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon size={18} stroke={1.8} />
              </button>
            )
          })}
        </div>
      </SettingRow>

      <SettingRow
        title="Righe per pagina"
        description={`Numero di ${entityLabel} mostrati per pagina.`}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {ROWS_OPTIONS.map((n) => {
            const active = rowsPerPage === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => onRowsPerPageChange(n)}
                className={cn(
                  "flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors duration-150",
                  active
                    ? "border border-navy bg-[#EEF2FF] text-navy"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
      </SettingRow>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Sheet impostazioni Lead                           */
/* -------------------------------------------------------------------------- */

export type SettingsSectionId = "colonne" | "generali" | "amministrazione"

const SECTIONS: {
  id: SettingsSectionId
  label: string
  description: string
  icon: typeof IconColumns3
}[] = [
  {
    id: "generali",
    label: "Generali",
    description: "Densità tabella e impaginazione dell'elenco lead.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    id: "colonne",
    label: "Vista colonne",
    description: "Scegli quali colonne mostrare nella tabella lead.",
    icon: IconColumns3,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti del modulo Lead.",
    icon: IconDatabaseCog,
  },
]

export function LeadSettingsSheet({
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
  visibleCols: LeadColumnId[]
  onVisibleColsChange: (cols: LeadColumnId[]) => void
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: SettingsSectionId
  onSectionChange: (s: SettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:w-1/2 data-[side=right]:sm:min-w-[34rem] data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Lead</SheetTitle>
          <SheetDescription>
            Personalizza colonne e visualizzazione dell&apos;elenco lead.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1">
          {/* Nav sezioni */}
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

          {/* Contenuto sezione */}
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
                />
              )}
              {section === "amministrazione" && (
                <ModuleGovernanceSection module="lead" label="Lead" />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
