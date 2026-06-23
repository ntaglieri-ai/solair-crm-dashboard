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
  INSTALLATORE_STATO_VALUES,
  mockInstallatoreProprietari,
} from "@/lib/mock-data"

export interface InstallatoreFilterState {
  search: string
  stato: string
  proprietario: string
  tag: string
}

export const DEFAULT_INSTALLATORE_FILTERS: InstallatoreFilterState = {
  search: "",
  stato: "all",
  proprietario: "all",
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

export function InstallatoreFilters({
  filters,
  tags,
  onChange,
  onReset,
}: {
  filters: InstallatoreFilterState
  tags: string[]
  onChange: (next: InstallatoreFilterState) => void
  onReset: () => void
}) {
  const set = <K extends keyof InstallatoreFilterState>(
    key: K,
    value: InstallatoreFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const hasActiveFilters =
    filters.search !== "" ||
    filters.stato !== "all" ||
    filters.proprietario !== "all" ||
    filters.tag !== "all"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Cerca nome, email o referente"
          className="bg-card pl-9"
          aria-label="Cerca installatori"
        />
      </div>

      <FilterSelect
        ariaLabel="Filtra per Stato"
        value={filters.stato}
        onValueChange={(v) => set("stato", v)}
        placeholder="Stato"
        options={[
          ["all", "Tutti gli stati"],
          ...INSTALLATORE_STATO_VALUES.map((s) => [s, s] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Proprietario di Installatore"
        className="w-[210px] bg-card"
        value={filters.proprietario}
        onValueChange={(v) => set("proprietario", v)}
        placeholder="Proprietario"
        options={[
          ["all", "Tutti i proprietari"],
          ...mockInstallatoreProprietari.map(
            (c) => [c, c] as [string, string],
          ),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Tag"
        className="w-[180px] bg-card"
        value={filters.tag}
        onValueChange={(v) => set("tag", v)}
        placeholder="Tag"
        options={[
          ["all", "Tutti i tag"],
          ...tags.map((t) => [t, t] as [string, string]),
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
