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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconFilter } from "@tabler/icons-react"
import {
  STATO_COMPITO_ORDER,
  PRIORITA_COMPITO_ORDER,
  SEDE_LABELS,
  mockProprietariCompito,
  type StatoCompito,
} from "@/lib/mock-data"

export interface CompitoFilterState {
  search: string
  stati: StatoCompito[]
  priorita: string
  proprietario: string
  sede: string
  scadenzaDa: string
  scadenzaA: string
}

export const DEFAULT_COMPITO_FILTERS: CompitoFilterState = {
  search: "",
  stati: [],
  priorita: "all",
  proprietario: "all",
  sede: "all",
  scadenzaDa: "",
  scadenzaA: "",
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
    <Select
      items={toItems(options)}
      value={value}
      onValueChange={(v) => onValueChange(v ?? "")}
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

export function CompitoFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: CompitoFilterState
  onChange: (next: CompitoFilterState) => void
  onReset: () => void
}) {
  const set = <K extends keyof CompitoFilterState>(
    key: K,
    value: CompitoFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const toggleStato = (s: StatoCompito) => {
    const next = filters.stati.includes(s)
      ? filters.stati.filter((x) => x !== s)
      : [...filters.stati, s]
    set("stati", next)
  }

  const hasActiveFilters =
    filters.search !== "" ||
    filters.stati.length > 0 ||
    filters.priorita !== "all" ||
    filters.proprietario !== "all" ||
    filters.sede !== "all" ||
    filters.scadenzaDa !== "" ||
    filters.scadenzaA !== ""

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Cerca per oggetto"
          className="bg-card pl-9"
          aria-label="Cerca compiti"
        />
      </div>

      {/* Stato (multi) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="bg-card">
              <IconFilter size={16} stroke={1.8} data-icon="inline-start" />
              Stato
              {filters.stati.length > 0 ? (
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-navy-foreground">
                  {filters.stati.length}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filtra per stato</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATO_COMPITO_ORDER.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={filters.stati.includes(s)}
              onCheckedChange={() => toggleStato(s)}
              onSelect={(e) => e.preventDefault()}
            >
              {s}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <FilterSelect
        ariaLabel="Filtra per Priorità"
        className="w-[150px] bg-card"
        value={filters.priorita}
        onValueChange={(v) => set("priorita", v)}
        placeholder="Priorità"
        options={[
          ["all", "Tutte le priorità"],
          ...PRIORITA_COMPITO_ORDER.map((p) => [p, p] as [string, string]),
        ]}
      />

      <FilterSelect
        ariaLabel="Filtra per Proprietario"
        className="w-[190px] bg-card"
        value={filters.proprietario}
        onValueChange={(v) => set("proprietario", v)}
        placeholder="Proprietario"
        options={[
          ["all", "Tutti i proprietari"],
          ...mockProprietariCompito.map((c) => [c, c] as [string, string]),
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

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={filters.scadenzaDa}
          onChange={(e) => set("scadenzaDa", e.target.value)}
          className="w-[150px] bg-card"
          aria-label="Scadenza da"
        />
        <span className="text-sm text-muted-foreground">→</span>
        <Input
          type="date"
          value={filters.scadenzaA}
          onChange={(e) => set("scadenzaA", e.target.value)}
          className="w-[150px] bg-card"
          aria-label="Scadenza a"
        />
      </div>

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
