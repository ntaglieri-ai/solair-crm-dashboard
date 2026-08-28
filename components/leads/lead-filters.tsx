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
import {
  STATO_LEAD_ORDER,
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"

export type ScoreFilter = "all" | "caldo" | "medio" | "freddo"

export interface LeadFilterState {
  search: string
  stato: string
  sede: string
  commerciale: string
  origine: string
  tag: string
  score: ScoreFilter
}

export const DEFAULT_FILTERS: LeadFilterState = {
  search: "",
  stato: "all",
  sede: "all",
  commerciale: "all",
  origine: "all",
  tag: "all",
  score: "all",
}

function FilterSelect({
  value,
  onValueChange,
  label,
  options,
}: {
  value: string
  onValueChange: (v: string) => void
  label: string
  options: [string, string][]
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={(next) => onValueChange(next ?? "all")}>
        <SelectTrigger className="h-11 w-full bg-card" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([optionValue, optionLabel]) => (
              <SelectItem key={optionValue} value={optionValue}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  )
}

/** Numero di filtri rapidi attivi (stato/sede/proprietario/origine/tag/valutazione). */
export function countActiveLeadFilters(filters: LeadFilterState): number {
  return (
    (filters.stato !== "all" ? 1 : 0) +
    (filters.sede !== "all" ? 1 : 0) +
    (filters.commerciale !== "all" ? 1 : 0) +
    (filters.origine !== "all" ? 1 : 0) +
    (filters.tag !== "all" ? 1 : 0) +
    (filters.score !== "all" ? 1 : 0)
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
  tags,
}: {
  filters: LeadFilterState
  onChange: (next: LeadFilterState) => void
  onReset: () => void
  tags: string[]
}) {
  const { owners } = useTags()
  const set = <K extends keyof LeadFilterState>(
    key: K,
    value: LeadFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const active = [
    filters.stato !== "all" ? ["stato", filters.stato] : null,
    filters.sede !== "all" ? ["sede", filters.sede] : null,
    filters.commerciale !== "all"
      ? ["commerciale", owners.find((owner) => owner.id === filters.commerciale)?.nome ?? filters.commerciale]
      : null,
    filters.origine !== "all" ? ["origine", filters.origine] : null,
    filters.tag !== "all" ? ["tag", filters.tag] : null,
    filters.score !== "all" ? ["score", filters.score] : null,
  ].filter(Boolean) as Array<[keyof LeadFilterState, string]>

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          label="Stato"
          value={filters.stato}
          onValueChange={(value) => set("stato", value)}
          options={[["all", "Tutti gli stati"], ...STATO_LEAD_ORDER.map((value) => [value, value] as [string, string])]}
        />
        <FilterSelect
          label="Sede"
          value={filters.sede}
          onValueChange={(value) => set("sede", value)}
          options={[["all", "Tutte le sedi"], ...SEDE_LABELS.map((value) => [value, value] as [string, string])]}
        />
        <FilterSelect
          label="Proprietario"
          value={filters.commerciale}
          onValueChange={(value) => set("commerciale", value)}
          options={[["all", "Tutti i proprietari"], ...owners.map((owner) => [owner.id, owner.nome] as [string, string])]}
        />
        <FilterSelect
          label="Origine"
          value={filters.origine}
          onValueChange={(value) => set("origine", value)}
          options={[["all", "Tutte le origini"], ...ORIGINE_LEAD_VALUES.map((value) => [value, value] as [string, string])]}
        />
        <FilterSelect
          label="Tag"
          value={filters.tag}
          onValueChange={(value) => set("tag", value)}
          options={[["all", "Tutti i tag"], ...tags.map((value) => [value, value] as [string, string])]}
        />
        <FilterSelect
          label="Valutazione"
          value={filters.score}
          onValueChange={(value) => set("score", value as ScoreFilter)}
          options={[
            ["all", "Tutte le valutazioni"],
            ["caldo", "Caldo (>80)"],
            ["medio", "Medio (50-80)"],
            ["freddo", "Freddo (<50)"],
          ]}
        />
      </div>

      {active.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {active.map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => set(key, "all" as never)}
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
