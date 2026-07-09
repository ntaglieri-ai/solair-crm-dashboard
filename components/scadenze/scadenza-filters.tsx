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
import { useScadenzeReferenceData } from "@/lib/scadenze/hooks"
import type { ScadenzeListParams } from "@/lib/scadenze/api-types"

export interface ScadenzaFilterState {
  search: string
  proprietario: string
  tag: string
  scadenzaDa: string
  scadenzaA: string
  collegamento: ScadenzeListParams["collegamento"]
}

export const DEFAULT_SCADENZA_FILTERS: ScadenzaFilterState = {
  search: "",
  proprietario: "all",
  tag: "all",
  scadenzaDa: "",
  scadenzaA: "",
  collegamento: "all",
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
    <Select items={toItems(options)} value={value} onValueChange={(v) => onValueChange(v ?? "")}>
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

export function ScadenzaFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: ScadenzaFilterState
  onChange: (next: ScadenzaFilterState) => void
  onReset: () => void
}) {
  const { data: referenceData } = useScadenzeReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const tags = referenceData?.tags ?? []

  const set = <K extends keyof ScadenzaFilterState>(key: K, value: ScadenzaFilterState[K]) =>
    onChange({ ...filters, [key]: value })

  const hasActiveFilters =
    filters.search !== "" ||
    filters.proprietario !== "all" ||
    filters.tag !== "all" ||
    filters.scadenzaDa !== "" ||
    filters.scadenzaA !== "" ||
    filters.collegamento !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Cerca per nome scadenza"
          className="bg-card pl-9"
          aria-label="Cerca scadenze"
        />
      </div>

      <FilterSelect
        ariaLabel="Filtra per Proprietario"
        className="w-[190px] bg-card"
        value={filters.proprietario}
        onValueChange={(v) => set("proprietario", v)}
        placeholder="Proprietario"
        options={[
          ["all", "Tutti i proprietari"],
          ...proprietari.map((p) => [p.id, p.nome] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Tag"
        className="w-[170px] bg-card"
        value={filters.tag}
        onValueChange={(v) => set("tag", v)}
        placeholder="Tag"
        options={[["all", "Tutti i tag"], ...tags.map((t) => [t, t] as [string, string])]}
      />

      <FilterSelect
        ariaLabel="Filtra per Collegamento"
        className="w-[170px] bg-card"
        value={filters.collegamento}
        onValueChange={(v) => set("collegamento", v as ScadenzeListParams["collegamento"])}
        placeholder="Collegamento"
        options={[
          ["all", "Tutti"],
          ["si", "Con collegamento"],
          ["no", "Senza collegamento"],
        ]}
      />

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={filters.scadenzaDa}
          onChange={(e) => set("scadenzaDa", e.target.value)}
          className="w-[150px] bg-card"
          aria-label="Data scadenza da"
        />
        <span className="text-sm text-muted-foreground">→</span>
        <Input
          type="date"
          value={filters.scadenzaA}
          onChange={(e) => set("scadenzaA", e.target.value)}
          className="w-[150px] bg-card"
          aria-label="Data scadenza a"
        />
      </div>

      <Button variant="ghost" onClick={onReset} disabled={!hasActiveFilters} className="text-muted-foreground">
        <X data-icon="inline-start" />
        Reset filtri
      </Button>
    </div>
  )
}
