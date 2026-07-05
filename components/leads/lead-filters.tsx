"use client"

import { Filter, Search, SlidersHorizontal, X } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

export function LeadFilters({
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
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="relative min-w-[280px] flex-1">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => set("search", event.target.value)}
          placeholder="Cerca lead per nome, email o telefono"
          className="h-12 rounded-lg border-border bg-card pl-12 text-[15px] shadow-sm"
          aria-label="Cerca lead"
        />
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="lg" className="bg-card">
              <SlidersHorizontal data-icon="inline-start" />
              Filtri
              {active.length > 0 ? (
                <span className="ml-1 rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {active.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-[min(92vw,620px)] gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Filter className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-bold">Filtra i lead</h3>
              <p className="text-xs text-muted-foreground">Combina i criteri di ricerca</p>
            </div>
          </div>
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
          <Button variant="ghost" onClick={onReset} disabled={active.length === 0}>
            <X data-icon="inline-start" />
            Azzera filtri
          </Button>
        </PopoverContent>
      </Popover>

      {active.map(([key, label]) => (
        <button
          type="button"
          key={key}
          onClick={() => set(key, "all" as never)}
          className="flex h-10 items-center gap-2 rounded-lg border border-primary/15 bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          {label}
          <X className="size-3.5" />
        </button>
      ))}
    </div>
  )
}
