"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  type Lead,
  STATO_LEAD_ORDER,
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
  mockCommerciali,
  mockInstallatori,
} from "@/lib/mock-data"

// ----------------------------------------------------------------------------
// Tipi filtro — logica pura condivisa con il repository server-side
// ----------------------------------------------------------------------------
import {
  type FieldType,
  type FieldValue,
  type AdvancedFilterState,
  EMPTY_ADVANCED,
  isFieldActive,
  countActiveAdvanced,
  matchesAdvanced,
} from "@/lib/leads/advanced-filter-logic"

// Re-export per retro-compatibilità con i consumer esistenti
export {
  EMPTY_ADVANCED,
  countActiveAdvanced,
  matchesAdvanced,
  type AdvancedFilterState,
}

interface FieldDef {
  id: keyof Lead
  label: string
  type: FieldType
  options?: string[]
}

const STATO_EMAIL_VALUES = ["Recapitata", "Aperta", "Non recapitata", "—"]
const MOBILE_FISSO_VALUES = ["Mobile", "Fisso"]

// Definizione dei campi del modello Lead in ordine alfabetico (italiano)
function buildFields(tags: string[]): FieldDef[] {
  return [
    { id: "Account convertito", label: "Account convertito", type: "text" },
    { id: "campaign name", label: "campaign name", type: "text" },
    { id: "Città", label: "Città", type: "text" },
    { id: "Codice postale", label: "Codice postale", type: "text" },
    { id: "Cognome", label: "Cognome", type: "text" },
    { id: "Connesso a", label: "Connesso a", type: "text" },
    { id: "Contatto convertito", label: "Contatto convertito", type: "text" },
    { id: "Creato da", label: "Creato da", type: "text" },
    { id: "Data Click", label: "Data Click", type: "date" },
    { id: "Data sopralluogo", label: "Data sopralluogo", type: "date" },
    { id: "Data/Ora", label: "Data/Ora", type: "date" },
    { id: "Descrizione", label: "Descrizione", type: "text" },
    { id: "E-mail", label: "E-mail", type: "text" },
    {
      id: "Installatore - Incaricato sopralluogo",
      label: "Installatore - Incaricato sopralluogo",
      type: "enum",
      options: mockInstallatori,
    },
    { id: "kWh", label: "kWh", type: "number" },
    { id: "kWp", label: "kWp", type: "number" },
    {
      id: "Lead Proprietario",
      label: "Lead Proprietario",
      type: "enum",
      options: mockCommerciali,
    },
    {
      id: "Mobile/Fisso",
      label: "Mobile/Fisso",
      type: "enum",
      options: MOBILE_FISSO_VALUES,
    },
    {
      id: "Modalità iscrizione annullata",
      label: "Modalità iscrizione annullata",
      type: "text",
    },
    { id: "Modello pannello", label: "Modello pannello", type: "text" },
    { id: "Nome", label: "Nome", type: "text" },
    { id: "Nome Lead", label: "Nome Lead", type: "text" },
    {
      id: "Ora iscrizione annullata",
      label: "Ora iscrizione annullata",
      type: "date",
    },
    { id: "Ora creazione", label: "Ora creazione", type: "date" },
    { id: "Ora ultima attività", label: "Ora ultima attività", type: "date" },
    {
      id: "Origine Lead",
      label: "Origine Lead",
      type: "enum",
      options: [...ORIGINE_LEAD_VALUES],
    },
    { id: "Paese", label: "Paese", type: "text" },
    { id: "Provincia", label: "Provincia", type: "text" },
    {
      id: "Residente in Sicilia",
      label: "Residente in Sicilia",
      type: "boolean",
    },
    { id: "Sede", label: "Sede", type: "enum", options: [...SEDE_LABELS] },
    { id: "Social Lead ID", label: "Social Lead ID", type: "text" },
    {
      id: "Stato",
      label: "Stato",
      type: "enum",
      options: STATO_EMAIL_VALUES,
    },
    {
      id: "Stato Lead",
      label: "Stato Lead",
      type: "enum",
      options: [...STATO_LEAD_ORDER],
    },
    { id: "Tag", label: "Tag", type: "enum", options: tags },
    { id: "Telefono", label: "Telefono", type: "text" },
    {
      id: "Tempo di conversione Lead",
      label: "Tempo di conversione Lead",
      type: "text",
    },
    { id: "Valutazione", label: "Valutazione", type: "number" },
  ]
}

// ----------------------------------------------------------------------------
// Pill riassuntiva di un filtro attivo
// ----------------------------------------------------------------------------
function fieldPillLabel(def: FieldDef, v: FieldValue): string {
  switch (v.type) {
    case "text":
      return `${def.label}: "${v.contains.trim()}"`
    case "enum":
      return `${def.label}: ${v.selected.join(", ")}`
    case "number": {
      if (v.min !== "" && v.max !== "")
        return `${def.label}: ${v.min}–${v.max}`
      if (v.min !== "") return `${def.label}: ≥${v.min}`
      return `${def.label}: ≤${v.max}`
    }
    case "date": {
      if (v.from !== "" && v.to !== "")
        return `${def.label}: ${v.from} → ${v.to}`
      if (v.from !== "") return `${def.label}: da ${v.from}`
      return `${def.label}: fino a ${v.to}`
    }
    case "boolean":
      return `${def.label}: ${v.value === "yes" ? "Sì" : "No"}`
  }
}

const QUICK_LABELS: Record<keyof AdvancedFilterState["quick"], string> = {
  badgeAttivita: "Badge dell'attività",
  badgeNota: "Badge di nota",
  nonToccati: "Record non toccati",
  toccati: "Record toccati",
}

// ----------------------------------------------------------------------------
// Componente principale
// ----------------------------------------------------------------------------
export function AdvancedFilters({
  applied,
  onApply,
  tags,
}: {
  applied: AdvancedFilterState
  onApply: (state: AdvancedFilterState) => void
  tags: string[]
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AdvancedFilterState>(applied)
  const [fieldQuery, setFieldQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const allFields = useMemo(() => buildFields(tags), [tags])
  const fieldsById = useMemo(
    () => new Map(allFields.map((f) => [f.id as string, f])),
    [allFields],
  )

  // Sincronizza il draft con lo stato applicato all'apertura del pannello
  useEffect(() => {
    if (open) {
      setDraft(applied)
      setFieldQuery("")
      setExpanded(null)
    }
  }, [open, applied])

  const visibleFields = useMemo(() => {
    const q = fieldQuery.trim().toLowerCase()
    if (!q) return allFields
    return allFields.filter((f) => f.label.toLowerCase().includes(q))
  }, [allFields, fieldQuery])

  const appliedCount = countActiveAdvanced(applied)
  const draftCount = countActiveAdvanced(draft)

  const setQuick = (key: keyof AdvancedFilterState["quick"], value: boolean) =>
    setDraft((d) => ({ ...d, quick: { ...d.quick, [key]: value } }))

  const setField = (id: string, value: FieldValue) =>
    setDraft((d) => ({ ...d, fields: { ...d.fields, [id]: value } }))

  const clearField = (id: string) =>
    setDraft((d) => {
      const next = { ...d.fields }
      delete next[id]
      return { ...d, fields: next }
    })

  const getDraftField = (def: FieldDef): FieldValue => {
    const existing = draft.fields[def.id as string]
    if (existing) return existing
    switch (def.type) {
      case "text":
        return { type: "text", contains: "" }
      case "enum":
        return { type: "enum", selected: [] }
      case "date":
        return { type: "date", from: "", to: "" }
      case "number":
        return { type: "number", min: "", max: "" }
      case "boolean":
        return { type: "boolean", value: "all" }
    }
  }

  // Pill dei filtri attivi nel draft
  const activePills: { id: string; label: string }[] = []
  for (const [key, on] of Object.entries(draft.quick)) {
    if (on)
      activePills.push({
        id: `quick:${key}`,
        label: QUICK_LABELS[key as keyof AdvancedFilterState["quick"]],
      })
  }
  for (const [id, v] of Object.entries(draft.fields)) {
    const def = fieldsById.get(id)
    if (def && isFieldActive(v))
      activePills.push({ id: `field:${id}`, label: fieldPillLabel(def, v) })
  }

  const removePill = (pillId: string) => {
    const [kind, key] = pillId.split(":")
    if (kind === "quick")
      setQuick(key as keyof AdvancedFilterState["quick"], false)
    else clearField(key)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon"
        className="relative bg-card"
        aria-label="Filtri avanzati"
        onClick={() => setOpen(true)}
      >
        <Filter />
        {appliedCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[10px] font-bold tabular-nums text-teal-foreground">
            {appliedCount}
          </span>
        ) : null}
      </Button>

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[340px] gap-0 p-0 sm:max-w-[340px]"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-4">
          <SheetTitle>Filtra Lead per</SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Ricerca campo */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fieldQuery}
                onChange={(e) => setFieldQuery(e.target.value)}
                placeholder="Cerca campo..."
                className="bg-card pl-9"
                aria-label="Cerca campo"
              />
            </div>
          </div>

          {/* Pill filtri attivi */}
          {activePills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border bg-muted/40 p-3">
              {activePills.map((pill) => (
                <span
                  key={pill.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
                >
                  <span className="truncate">{pill.label}</span>
                  <button
                    type="button"
                    aria-label={`Rimuovi ${pill.label}`}
                    onClick={() => removePill(pill.id)}
                    className="shrink-0 rounded-full hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {/* Filtri rapidi (collassati di default) */}
          <Accordion className="border-b border-border px-3">
            <AccordionItem value="quick" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold">
                Filtri rapidi
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-2.5">
                  {(
                    Object.keys(draft.quick) as (keyof AdvancedFilterState["quick"])[]
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={draft.quick[key]}
                        onCheckedChange={(c) => setQuick(key, c === true)}
                      />
                      {QUICK_LABELS[key]}
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Filtra per campo */}
          <div className="p-3">
            <p className="px-1 pb-2 text-sm font-semibold text-foreground">
              Filtra per campo
            </p>
            <div className="flex flex-col">
              {visibleFields.map((def) => {
                const id = def.id as string
                const isOpen = expanded === id
                const v = getDraftField(def)
                const active = draft.fields[id]
                  ? isFieldActive(draft.fields[id])
                  : false
                return (
                  <div
                    key={id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                        active && "font-medium text-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {active ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-teal" />
                        ) : null}
                        <span className="truncate">{def.label}</span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>

                    {isOpen ? (
                      <div className="px-2 pb-3 pt-1">
                        <FieldEditor
                          def={def}
                          value={v}
                          onChange={(nv) => setField(id, nv)}
                          onClear={() => clearField(id)}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {visibleFields.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Nessun campo trovato
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border p-4">
          <Button
            variant="outline"
            className="flex-1 bg-card"
            onClick={() => setDraft(EMPTY_ADVANCED)}
            disabled={draftCount === 0}
          >
            <RotateCcw data-icon="inline-start" />
            Reimposta tutto
          </Button>
          <Button
            className="flex-1 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => {
              onApply(draft)
              setOpen(false)
            }}
          >
            Applica filtri
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ----------------------------------------------------------------------------
// Mini-form per tipo campo
// ----------------------------------------------------------------------------
function FieldEditor({
  def,
  value,
  onChange,
  onClear,
}: {
  def: FieldDef
  value: FieldValue
  onChange: (v: FieldValue) => void
  onClear: () => void
}) {
  if (value.type === "text") {
    return (
      <Input
        autoFocus
        value={value.contains}
        onChange={(e) => onChange({ type: "text", contains: e.target.value })}
        placeholder="contiene..."
        className="bg-card"
        aria-label={`${def.label} contiene`}
      />
    )
  }

  if (value.type === "enum") {
    const selected = value.selected
    return (
      <div className="flex flex-col gap-2">
        {(def.options ?? []).map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
          >
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={(c) =>
                onChange({
                  type: "enum",
                  selected:
                    c === true
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt),
                })
              }
            />
            <span className="truncate">{opt}</span>
          </label>
        ))}
        {(def.options ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun valore</p>
        ) : null}
      </div>
    )
  }

  if (value.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value.min}
          onChange={(e) =>
            onChange({ type: "number", min: e.target.value, max: value.max })
          }
          placeholder="Min"
          className="bg-card"
          aria-label={`${def.label} minimo`}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          value={value.max}
          onChange={(e) =>
            onChange({ type: "number", min: value.min, max: e.target.value })
          }
          placeholder="Max"
          className="bg-card"
          aria-label={`${def.label} massimo`}
        />
      </div>
    )
  }

  if (value.type === "date") {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Da
          <Input
            type="date"
            value={value.from}
            onChange={(e) =>
              onChange({ type: "date", from: e.target.value, to: value.to })
            }
            className="w-[170px] bg-card"
            aria-label={`${def.label} da`}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          A
          <Input
            type="date"
            value={value.to}
            onChange={(e) =>
              onChange({ type: "date", from: value.from, to: e.target.value })
            }
            className="w-[170px] bg-card"
            aria-label={`${def.label} a`}
          />
        </label>
      </div>
    )
  }

  // boolean
  const current = value.value
  return (
    <div className="flex items-center gap-1.5">
      {(
        [
          ["all", "Tutti"],
          ["yes", "Sì"],
          ["no", "No"],
        ] as const
      ).map(([val, label]) => (
        <Button
          key={val}
          type="button"
          size="sm"
          variant={current === val ? "default" : "outline"}
          className={cn(
            "flex-1",
            current === val
              ? "bg-teal text-teal-foreground hover:bg-teal/90"
              : "bg-card",
          )}
          onClick={() => onChange({ type: "boolean", value: val })}
        >
          {label}
        </Button>
      ))}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Azzera campo"
        onClick={onClear}
      >
        <X />
      </Button>
    </div>
  )
}
