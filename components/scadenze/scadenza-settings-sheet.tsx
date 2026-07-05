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
  SCADENZA_COLUMNS,
  DEFAULT_SCADENZA_COLUMNS,
  type ScadenzaColumnId,
  type Density,
} from "./scadenza-table"
import { GeneralSection } from "@/components/leads/lead-settings-sheet"
import { RulesSection } from "@/components/leads/assignment-rules"
import { ClienteTagSection } from "@/components/clienti/cliente-tag-section"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

/* -------------------------------------------------------------------------- */
/*                          Sezione: Vista colonne                            */
/* -------------------------------------------------------------------------- */

function ColumnsSection({
  visible,
  onChange,
}: {
  visible: ScadenzaColumnId[]
  onChange: (cols: ScadenzaColumnId[]) => void
}) {
  const [query, setQuery] = useState("")
  const set = new Set(visible)
  const q = query.trim().toLowerCase()

  const toggle = (id: ScadenzaColumnId) => {
    const col = SCADENZA_COLUMNS.find((c) => c.id === id)
    if (col?.mandatory) return
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // Mantiene l'ordine del registro colonne.
    onChange(SCADENZA_COLUMNS.filter((c) => next.has(c.id)).map((c) => c.id))
  }

  const cols = useMemo(
    () =>
      SCADENZA_COLUMNS.filter(
        (c) => q === "" || c.label.toLowerCase().includes(q),
      ),
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
          {visible.length} di {SCADENZA_COLUMNS.length} colonne visibili
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...DEFAULT_SCADENZA_COLUMNS])}
        >
          Ripristina default
        </Button>
      </div>

      {cols.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna colonna trovata.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {cols.map((col) => (
            <label
              key={col.id}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                col.mandatory
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-secondary/60",
              )}
            >
              <Checkbox
                checked={set.has(col.id)}
                disabled={col.mandatory}
                onCheckedChange={() => toggle(col.id)}
              />
              <span className="text-foreground">{col.label}</span>
              {col.mandatory ? (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Sempre visibile
                </span>
              ) : null}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                        Sheet impostazioni Scadenze                         */
/* -------------------------------------------------------------------------- */

export type ScadenzaSettingsSectionId =
  | "tag"
  | "regole"
  | "colonne"
  | "generali"
  | "amministrazione"

const SECTIONS: {
  id: ScadenzaSettingsSectionId
  label: string
  description: string
  icon: typeof IconTag
}[] = [
  {
    id: "generali",
    label: "Generali",
    description: "Densità tabella e impaginazione dell'elenco scadenze.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    id: "colonne",
    label: "Vista colonne",
    description: "Scegli quali colonne mostrare nella tabella scadenze.",
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
      "Assegna automaticamente le nuove scadenze ai commerciali in base a criteri.",
    icon: IconRoute,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti delle Scadenze.",
    icon: IconDatabaseCog,
  },
]

export function ScadenzaSettingsSheet({
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
  visibleCols: ScadenzaColumnId[]
  onVisibleColsChange: (cols: ScadenzaColumnId[]) => void
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: ScadenzaSettingsSectionId
  onSectionChange: (s: ScadenzaSettingsSectionId) => void
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
          <SheetTitle>Impostazioni Scadenze</SheetTitle>
          <SheetDescription>
            Personalizza tag, colonne e visualizzazione dell&apos;elenco
            scadenze.
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
              {section === "tag" && <ClienteTagSection />}
              {section === "regole" && <RulesSection />}
              {section === "amministrazione" && (
                <ModuleGovernanceSection module="scadenze" label="Scadenze" />
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
                  entityLabel="scadenze"
                />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
