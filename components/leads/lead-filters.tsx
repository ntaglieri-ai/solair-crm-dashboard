"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  STATO_LEAD_ORDER,
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"
import { MultiFilterSelect, type MultiFilterOption } from "@/components/shared/multi-filter-select"
import { hasFilterValues } from "@/lib/shared/filter-values"

export type ScoreFilter = "all" | "caldo" | "medio" | "freddo"
type ScoreFilterValue = Exclude<ScoreFilter, "all">

export interface LeadFilterState {
  search: string
  stato: string[]
  sede: string[]
  commerciale: string[]
  origine: string[]
  tag: string[]
  score: ScoreFilterValue[]
}

export const DEFAULT_FILTERS: LeadFilterState = {
  search: "",
  stato: [],
  sede: [],
  commerciale: [],
  origine: [],
  tag: [],
  score: [],
}

function FilterSelect({
  value,
  onValueChange,
  label,
  options,
  allLabel,
}: {
  value: string[]
  onValueChange: (v: string[]) => void
  label: string
  options: MultiFilterOption[]
  allLabel: string
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <MultiFilterSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        allLabel={allLabel}
        ariaLabel={label}
      />
    </label>
  )
}

/** Numero di filtri rapidi attivi (stato/sede/proprietario/origine/tag/valutazione). */
export function countActiveLeadFilters(filters: LeadFilterState): number {
  return (
    (hasFilterValues(filters.stato) ? 1 : 0) +
    (hasFilterValues(filters.sede) ? 1 : 0) +
    (hasFilterValues(filters.commerciale) ? 1 : 0) +
    (hasFilterValues(filters.origine) ? 1 : 0) +
    (hasFilterValues(filters.tag) ? 1 : 0) +
    (hasFilterValues(filters.score) ? 1 : 0)
  )
}

/** Sola barra di ricerca: resta sempre in vista sopra la lista. */
export function LeadSearchInput({
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
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cerca lead per nome, email o telefono"
        className="h-10 rounded-lg border-border bg-card pl-10 text-sm shadow-sm sm:h-12 sm:pl-12 sm:text-[15px]"
        aria-label="Cerca lead"
      />
    </div>
  )
}

/** Griglia dei filtri rapidi (stato/sede/proprietario/…), pensata per vivere
 * dentro il drawer "Filtri" insieme ai filtri avanzati sui campi. */
export function LeadQuickFilterFields({
  filters,
  onChange,
  onReset,
}: {
  filters: LeadFilterState
  onChange: (next: LeadFilterState) => void
  onReset: () => void
}) {
  const { owners, tags } = useTags()
  const set = <K extends keyof LeadFilterState>(
    key: K,
    value: LeadFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const optionsByKey = {
    stato: STATO_LEAD_ORDER.map((value) => ({ value, label: value })),
    sede: SEDE_LABELS.map((value) => ({ value, label: value })),
    commerciale: owners.map((owner) => ({ value: owner.id, label: owner.nome })),
    origine: ORIGINE_LEAD_VALUES.map((value) => ({ value, label: value })),
    tag: tags.map((tag) => ({ value: tag.id, label: tag.name })),
    score: [
      { value: "caldo", label: "Caldo (>80)" },
      { value: "medio", label: "Medio (50-80)" },
      { value: "freddo", label: "Freddo (<50)" },
    ],
  } satisfies Record<Exclude<keyof LeadFilterState, "search">, MultiFilterOption[]>
  const labelsFor = (selected: string[], options: MultiFilterOption[]) =>
    selected
      .map((value) => options.find((option) => option.value === value)?.label ?? value)
      .join(", ")

  const active = [
    filters.stato.length > 0 ? ["stato", labelsFor(filters.stato, optionsByKey.stato)] : null,
    filters.sede.length > 0 ? ["sede", labelsFor(filters.sede, optionsByKey.sede)] : null,
    filters.commerciale.length > 0
      ? ["commerciale", labelsFor(filters.commerciale, optionsByKey.commerciale)]
      : null,
    filters.origine.length > 0 ? ["origine", labelsFor(filters.origine, optionsByKey.origine)] : null,
    filters.tag.length > 0 ? ["tag", labelsFor(filters.tag, optionsByKey.tag)] : null,
    filters.score.length > 0 ? ["score", labelsFor(filters.score, optionsByKey.score)] : null,
  ].filter(Boolean) as Array<[keyof LeadFilterState, string]>

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          label="Stato"
          value={filters.stato}
          onValueChange={(value) => set("stato", value)}
          allLabel="Tutti gli stati"
          options={optionsByKey.stato}
        />
        <FilterSelect
          label="Sede"
          value={filters.sede}
          onValueChange={(value) => set("sede", value)}
          allLabel="Tutte le sedi"
          options={optionsByKey.sede}
        />
        <FilterSelect
          label="Proprietario"
          value={filters.commerciale}
          onValueChange={(value) => set("commerciale", value)}
          allLabel="Tutti i proprietari"
          options={optionsByKey.commerciale}
        />
        <FilterSelect
          label="Origine"
          value={filters.origine}
          onValueChange={(value) => set("origine", value)}
          allLabel="Tutte le origini"
          options={optionsByKey.origine}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          onValueChange={(value) => set("tag", value)}
          allLabel="Tutti i tag"
          options={optionsByKey.tag}
        />
        <FilterSelect
          label="Valutazione"
          value={filters.score}
          onValueChange={(value) => set("score", value as ScoreFilterValue[])}
          allLabel="Tutte le valutazioni"
          options={optionsByKey.score}
        />
      </div>

      {active.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {active.map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => set(key, [] as never)}
              className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-primary/15 bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
            >
              <span className="min-w-0 break-words">{label}</span>
              <X className="size-3.5 shrink-0" />
            </button>
          ))}
        </div>
      ) : null}

      <Button variant="ghost" className="self-start" onClick={onReset} disabled={active.length === 0}>
        <X data-icon="inline-start" />
        Azzera filtri rapidi
      </Button>
    </div>
  )
}
