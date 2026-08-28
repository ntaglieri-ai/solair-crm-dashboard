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

export function countActiveClienteFilters(filters: ClienteFilterState): number {
  return (
    (filters.stato !== "all" ? 1 : 0) +
    (filters.sede !== "all" ? 1 : 0) +
    (filters.proprietario !== "all" ? 1 : 0) +
    (filters.installatore !== "all" ? 1 : 0) +
    (filters.tag !== "all" ? 1 : 0)
  )
}

/** Sola barra di ricerca: resta sempre in vista sopra la lista. */
export function ClienteSearchInput({
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
        placeholder="Cerca nome, email o cellulare"
        className="h-10 rounded-lg border-border bg-card pl-10 text-sm shadow-sm sm:h-12 sm:pl-12 sm:text-[15px]"
        aria-label="Cerca clienti"
      />
    </div>
  )
}

/** Griglia dei filtri (stato/sede/proprietario/installatore/tag), pensata per
 * vivere dentro il drawer "Filtri". */
export function ClienteQuickFilterFields({
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

  const hasActiveFilters = countActiveClienteFilters(filters) > 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          ariaLabel="Filtra per Stato"
          className="w-full bg-card"
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
          className="w-full bg-card"
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
          className="w-full bg-card"
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
          className="w-full bg-card"
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
          className="w-full bg-card"
          value={filters.tag}
          onValueChange={(v) => set("tag", v)}
          placeholder="Tag"
          disabled
          options={[["all", "Tag (presto)"]]}
        />
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
