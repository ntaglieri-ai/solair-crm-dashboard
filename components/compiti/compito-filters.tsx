"use client"

import { Search, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  STATO_COMPITO_ORDER,
  PRIORITA_COMPITO_ORDER,
  SEDE_LABELS,
  type StatoCompito,
} from "@/lib/mock-data"
import { useCompitiReferenceData } from "@/lib/compiti/hooks"

export interface CompitoFilterState {
  search: string
  stati: StatoCompito[]
  priorita: string
  proprietario: string
  sede: string
  scadenzaDa: string
  scadenzaA: string
  /** Quick-filter KPI: solo scaduti (scadenza < adesso, stato ≠ Completato). */
  overdue: boolean
}

export const DEFAULT_COMPITO_FILTERS: CompitoFilterState = {
  search: "",
  stati: [],
  priorita: "all",
  proprietario: "all",
  sede: "all",
  scadenzaDa: "",
  scadenzaA: "",
  overdue: false,
}

function toItems(entries: [string, string][]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, [k, v]) => {
    acc[k] = v
    return acc
  }, {})
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className,
  ariaLabel,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  options: [string, string][]
  className?: string
  ariaLabel: string
}) {
  return (
    <Select
      items={toItems(options)}
      value={value}
      onValueChange={(v) => onValueChange(v ?? "")}
    >
      <SelectTrigger
        className={className ?? "w-full bg-card sm:w-[160px]"}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(([val, label]) => (
            <SelectItem key={val} value={val}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function countActiveCompitoFilters(filters: CompitoFilterState): number {
  return (
    (filters.stati.length > 0 ? 1 : 0) +
    (filters.priorita !== "all" ? 1 : 0) +
    (filters.proprietario !== "all" ? 1 : 0) +
    (filters.sede !== "all" ? 1 : 0) +
    (filters.scadenzaDa !== "" ? 1 : 0) +
    (filters.scadenzaA !== "" ? 1 : 0) +
    (filters.overdue ? 1 : 0)
  )
}

/** Sola barra di ricerca: resta sempre in vista sopra la lista. */
export function CompitoSearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground sm:left-4 sm:size-5" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cerca per oggetto"
        className="h-10 rounded-lg border-border bg-card pl-10 text-sm shadow-sm sm:h-12 sm:pl-12 sm:text-[15px]"
        aria-label="Cerca compiti"
      />
    </div>
  )
}

/** Griglia dei filtri (stato/priorità/proprietario/sede/date), pensata per
 * vivere dentro il drawer "Filtri". */
export function CompitoQuickFilterFields({
  filters,
  onChange,
  onReset,
}: {
  filters: CompitoFilterState
  onChange: (next: CompitoFilterState) => void
  onReset: () => void
}) {
  const { data: referenceData } = useCompitiReferenceData()
  const proprietari = referenceData?.proprietari ?? []

  const set = <K extends keyof CompitoFilterState>(
    key: K,
    value: CompitoFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const toggleStato = (s: StatoCompito) => {
    const next = filters.stati.includes(s)
      ? filters.stati.filter((x) => x !== s)
      : [...filters.stati, s]
    set("stati", next)
  }

  const hasActiveFilters = countActiveCompitoFilters(filters) > 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Stato</p>
        <div className="flex flex-wrap gap-2">
          {STATO_COMPITO_ORDER.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggleStato(s)}
              className={cn(
                "h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors",
                filters.stati.includes(s)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          ariaLabel="Filtra per Priorità"
          className="w-full bg-card"
          value={filters.priorita}
          onValueChange={(v) => set("priorita", v)}
          placeholder="Priorità"
          options={[
            ["all", "Tutte le priorità"],
            ...PRIORITA_COMPITO_ORDER.map((p) => [p, p] as [string, string]),
          ]}
        />

        <FilterSelect
          ariaLabel="Filtra per Proprietario"
          className="w-full bg-card"
          value={filters.proprietario}
          onValueChange={(v) => set("proprietario", v)}
          placeholder="Proprietario"
          options={[
            ["all", "Tutti i proprietari"],
            ...proprietari.map((p) => [p.nome, p.nome] as [string, string]),
          ]}
        />

        <FilterSelect
          ariaLabel="Filtra per Sede"
          className="w-full bg-card"
          value={filters.sede}
          onValueChange={(v) => set("sede", v)}
          placeholder="Sede"
          options={[
            ["all", "Tutte le sedi"],
            ...SEDE_LABELS.map((s) => [s, s] as [string, string]),
          ]}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Scadenza</p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <Input
            type="date"
            value={filters.scadenzaDa}
            onChange={(e) => set("scadenzaDa", e.target.value)}
            className="w-full bg-card"
            aria-label="Scadenza da"
          />
          <span className="text-sm text-muted-foreground">→</span>
          <Input
            type="date"
            value={filters.scadenzaA}
            onChange={(e) => set("scadenzaA", e.target.value)}
            className="w-full bg-card"
            aria-label="Scadenza a"
          />
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={onReset}
        disabled={!hasActiveFilters}
        className="self-start text-muted-foreground"
      >
        <X data-icon="inline-start" />
        Azzera filtri
      </Button>
    </div>
  )
}
