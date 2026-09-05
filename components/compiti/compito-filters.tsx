"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  STATO_COMPITO_ORDER,
  PRIORITA_COMPITO_ORDER,
  SEDE_LABELS,
  type StatoCompito,
} from "@/lib/mock-data"
import { useCompitiReferenceData } from "@/lib/compiti/hooks"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import { hasFilterValues } from "@/lib/shared/filter-values"
import { option } from "@/lib/crm-settings/column-values"
import { useColumnValueOptions } from "@/lib/crm-settings/use-column-values"

export interface CompitoFilterState {
  search: string
  stati: StatoCompito[]
  priorita: string[]
  proprietario: string[]
  sede: string[]
  scadenzaDa: string
  scadenzaA: string
  /** Quick-filter KPI: solo scaduti (scadenza < adesso, stato ≠ Completato). */
  overdue: boolean
}

export const DEFAULT_COMPITO_FILTERS: CompitoFilterState = {
  search: "",
  stati: [],
  priorita: [],
  proprietario: [],
  sede: [],
  scadenzaDa: "",
  scadenzaA: "",
  overdue: false,
}

export function countActiveCompitoFilters(filters: CompitoFilterState): number {
  return (
    (filters.stati.length > 0 ? 1 : 0) +
    (hasFilterValues(filters.priorita) ? 1 : 0) +
    (hasFilterValues(filters.proprietario) ? 1 : 0) +
    (hasFilterValues(filters.sede) ? 1 : 0) +
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
  const statoOptions = useColumnValueOptions(
    "Compiti",
    "stato",
    STATO_COMPITO_ORDER.map((s) => option(s)),
    { includeFallback: true },
  ).options
  const prioritaOptions = useColumnValueOptions(
    "Compiti",
    "priorita",
    PRIORITA_COMPITO_ORDER.map((p) => option(p)),
    { includeFallback: true },
  ).options
  const sedeOptions = useColumnValueOptions(
    "Compiti",
    "sede",
    SEDE_LABELS.map((s) => option(s)),
    { includeFallback: true },
  ).options

  const set = <K extends keyof CompitoFilterState>(
    key: K,
    value: CompitoFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const hasActiveFilters = countActiveCompitoFilters(filters) > 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MultiFilterSelect
          ariaLabel="Filtra per Stato"
          className="w-full bg-card"
          value={filters.stati}
          onValueChange={(v) => set("stati", v as StatoCompito[])}
          allLabel="Tutti gli stati"
          options={statoOptions}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Priorità"
          className="w-full bg-card"
          value={filters.priorita}
          onValueChange={(v) => set("priorita", v)}
          allLabel="Tutte le priorità"
          options={prioritaOptions}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Proprietario"
          className="w-full bg-card"
          value={filters.proprietario}
          onValueChange={(v) => set("proprietario", v)}
          allLabel="Tutti i proprietari"
          options={proprietari.map((p) => ({ value: p.nome, label: p.nome }))}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Sede"
          className="w-full bg-card"
          value={filters.sede}
          onValueChange={(v) => set("sede", v)}
          allLabel="Tutte le sedi"
          options={sedeOptions}
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
