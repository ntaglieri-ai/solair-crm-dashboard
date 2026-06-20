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
  STATO_CLIENTE_VALUES,
  SEDE_LABELS,
  mockCommerciali,
  mockInstallatori,
} from "@/lib/mock-data"

export interface ClienteFilterState {
  search: string
  stato: string
  sede: string
  proprietario: string
  installatore: string
  tag: string
}

export const DEFAULT_CLIENTE_FILTERS: ClienteFilterState = {
  search: "",
  stato: "all",
  sede: "all",
  proprietario: "all",
  installatore: "all",
  tag: "all",
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
  disabled,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  options: [string, string][]
  className?: string
  ariaLabel: string
  disabled?: boolean
}) {
  const items = toItems(options)
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onValueChange(v ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        className={className ?? "w-[160px] bg-card"}
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

export function ClienteFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: ClienteFilterState
  onChange: (next: ClienteFilterState) => void
  onReset: () => void
}) {
  const set = <K extends keyof ClienteFilterState>(
    key: K,
    value: ClienteFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const hasActiveFilters =
    filters.search !== "" ||
    filters.stato !== "all" ||
    filters.sede !== "all" ||
    filters.proprietario !== "all" ||
    filters.installatore !== "all" ||
    filters.tag !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Cerca nome, email o cellulare"
          className="bg-card pl-9"
          aria-label="Cerca clienti"
        />
      </div>

      <FilterSelect
        ariaLabel="Filtra per Stato"
        className="w-[200px] bg-card"
        value={filters.stato}
        onValueChange={(v) => set("stato", v)}
        placeholder="Stato"
        options={[
          ["all", "Tutti gli stati"],
          ...STATO_CLIENTE_VALUES.map((s) => [s, s] as [string, string]),
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
        ariaLabel="Filtra per Clienti Proprietario"
        className="w-[190px] bg-card"
        value={filters.proprietario}
        onValueChange={(v) => set("proprietario", v)}
        placeholder="Proprietario"
        options={[
          ["all", "Tutti i proprietari"],
          ...mockCommerciali.map((c) => [c, c] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Installatore"
        className="w-[180px] bg-card"
        value={filters.installatore}
        onValueChange={(v) => set("installatore", v)}
        placeholder="Installatore"
        options={[
          ["all", "Tutti gli installatori"],
          ...mockInstallatori.map((i) => [i, i] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Tag"
        value={filters.tag}
        onValueChange={(v) => set("tag", v)}
        placeholder="Tag"
        disabled
        options={[["all", "Tag (presto)"]]}
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
