"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import type { InstallatoriListParams } from "@/lib/installatori/api-types"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import { hasFilterValues } from "@/lib/shared/filter-values"

export interface InstallatoreFilterState {
  search: string
  proprietario: string[]
  tag: string[]
  stato: InstallatoriListParams["stato"]
}

export const DEFAULT_INSTALLATORE_FILTERS: InstallatoreFilterState = {
  search: "",
  proprietario: [],
  tag: [],
  stato: [],
}

export function countActiveInstallatoreFilters(filters: InstallatoreFilterState): number {
  return (
    (hasFilterValues(filters.proprietario) ? 1 : 0) +
    (hasFilterValues(filters.tag) ? 1 : 0) +
    (hasFilterValues(filters.stato) ? 1 : 0)
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
        <MultiFilterSelect
          ariaLabel="Filtra per Stato"
          className="w-full bg-card"
          value={filters.stato}
          onValueChange={(v) => set("stato", v as InstallatoreFilterState["stato"])}
          allLabel="Tutti gli stati"
          options={[
            { value: "attivo", label: "Attivo" },
            { value: "non_attivo", label: "Non attivo" },
          ]}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Proprietario"
          className="w-full bg-card"
          value={filters.proprietario}
          onValueChange={(v) => set("proprietario", v)}
          allLabel="Tutti i proprietari"
          options={proprietari.map((p) => ({ value: p.id, label: p.nome }))}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Tag"
          className="w-full bg-card"
          value={filters.tag}
          onValueChange={(v) => set("tag", v)}
          allLabel="Tutti i tag"
          options={tags.map((t) => ({ value: t.id, label: t.name }))}
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
