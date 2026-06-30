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
  mockCommerciali,
} from "@/lib/mock-data"

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
    <Select value={value} onValueChange={(next) => onValueChange(next ?? "all")}>
      <SelectTrigger className={className ?? "w-[160px] bg-card"} aria-label={ariaLabel}>
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
  const set = <K extends keyof LeadFilterState>(
    key: K,
    value: LeadFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const hasActiveFilters =
    filters.search !== "" ||
    filters.stato !== "all" ||
    filters.sede !== "all" ||
    filters.commerciale !== "all" ||
    filters.origine !== "all" ||
    filters.tag !== "all" ||
    filters.score !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Cerca nome, email o telefono"
          className="bg-card pl-9"
          aria-label="Cerca lead"
        />
      </div>

      <FilterSelect
        ariaLabel="Filtra per Stato Lead"
        className="w-[180px] bg-card"
        value={filters.stato}
        onValueChange={(v) => set("stato", v)}
        placeholder="Stato Lead"
        options={[
          ["all", "Tutti gli stati"],
          ...STATO_LEAD_ORDER.map((s) => [s, s] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Sede"
        value={filters.sede}
        onValueChange={(v) => set("sede", v)}
        placeholder="Sede"
        options={[
          ["all", "Tutte le sedi"],
          ...SEDE_LABELS.map((s) => [s, s] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Lead Proprietario"
        className="w-[190px] bg-card"
        value={filters.commerciale}
        onValueChange={(v) => set("commerciale", v)}
        placeholder="Lead Proprietario"
        options={[
          ["all", "Tutti i proprietari"],
          ...mockCommerciali.map((c) => [c, c] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Origine Lead"
        value={filters.origine}
        onValueChange={(v) => set("origine", v)}
        placeholder="Origine"
        options={[
          ["all", "Tutte le origini"],
          ...ORIGINE_LEAD_VALUES.map((o) => [o, o] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Tag"
        value={filters.tag}
        onValueChange={(v) => set("tag", v)}
        placeholder="Tag"
        options={[
          ["all", "Tutti i tag"],
          ...tags.map((t) => [t, t] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Valutazione"
        value={filters.score}
        onValueChange={(v) => set("score", v as ScoreFilter)}
        placeholder="Valutazione"
        options={[
          ["all", "Tutte le valutazioni"],
          ["caldo", "Caldo (>80)"],
          ["medio", "Medio (50-80)"],
          ["freddo", "Freddo (<50)"],
        ]}
      />

      <Button
        variant="ghost"
        onClick={onReset}
        disabled={!hasActiveFilters}
        className="text-muted-foreground"
      >
        <X data-icon="inline-start" />
        Reset filtri
      </Button>
    </div>
  )
}
