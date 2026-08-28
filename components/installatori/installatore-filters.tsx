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
import { useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import type { InstallatoriListParams } from "@/lib/installatori/api-types"

export interface InstallatoreFilterState {
  search: string
  proprietario: string
  tag: string
  stato: InstallatoriListParams["stato"]
}

export const DEFAULT_INSTALLATORE_FILTERS: InstallatoreFilterState = {
  search: "",
  proprietario: "all",
  tag: "all",
  stato: "all",
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
      <SelectTrigger className={className ?? "w-full bg-card sm:w-[160px]"} aria-label={ariaLabel}>
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

export function countActiveInstallatoreFilters(filters: InstallatoreFilterState): number {
  return (
    (filters.proprietario !== "all" ? 1 : 0) +
    (filters.tag !== "all" ? 1 : 0) +
    (filters.stato !== "all" ? 1 : 0)
  )
}

/** Sola barra di ricerca: resta sempre in vista sopra la lista. */
export function InstallatoreSearchInput({
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
        placeholder="Cerca per nome o e-mail"
        className="h-10 rounded-lg border-border bg-card pl-10 text-sm shadow-sm sm:h-12 sm:pl-12 sm:text-[15px]"
        aria-label="Cerca installatori"
      />
    </div>
  )
}

/** Griglia dei filtri (stato/proprietario/tag), pensata per vivere dentro il
 * drawer "Filtri". */
export function InstallatoreQuickFilterFields({
  filters,
  onChange,
  onReset,
}: {
  filters: InstallatoreFilterState
  onChange: (next: InstallatoreFilterState) => void
  onReset: () => void
}) {
  const { data: referenceData } = useInstallatoriReferenceData()
  const proprietari = referenceData?.owners ?? []
  const tags = referenceData?.tags ?? []

  const set = <K extends keyof InstallatoreFilterState>(
    key: K,
    value: InstallatoreFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const hasActiveFilters = countActiveInstallatoreFilters(filters) > 0

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FilterSelect
          ariaLabel="Filtra per Stato"
          className="w-full bg-card"
          value={filters.stato}
          onValueChange={(v) => set("stato", v as InstallatoreFilterState["stato"])}
          placeholder="Stato"
          options={[
            ["all", "Tutti gli stati"],
            ["attivo", "Attivo"],
            ["non_attivo", "Non attivo"],
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
            ...proprietari.map((p) => [p.id, p.nome] as [string, string]),
          ]}
        />

        <FilterSelect
          ariaLabel="Filtra per Tag"
          className="w-full bg-card"
          value={filters.tag}
          onValueChange={(v) => set("tag", v)}
          placeholder="Tag"
          options={[["all", "Tutti i tag"], ...tags.map((t) => [t.id, t.name] as [string, string])]}
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
