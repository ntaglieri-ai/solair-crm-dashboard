"use client"

import { Search, X } from "lucide-react"
import { IconFilter } from "@tabler/icons-react"
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
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { mockProprietariScadenza } from "@/lib/mock-data"

export interface ScadenzaFilterState {
  search: string
  proprietario: string
  scadenzaDa: string
  scadenzaA: string
}

export const DEFAULT_SCADENZA_FILTERS: ScadenzaFilterState = {
  search: "",
  proprietario: "all",
  scadenzaDa: "",
  scadenzaA: "",
}

/** Campi filtrabili avanzati (pannello funnel, pattern Zoho/Lead). */
const ADVANCED_FIELDS = [
  "Connesso a",
  "Creato da",
  "Data scadenza",
  "Modalità iscrizione annullata",
  "Nome Scadenze",
  "Ora creazione",
  "Ora iscrizione annullata",
  "Ora modifica",
  "Ora ultima attività",
  "Proprietario di Scadenze",
  "Tag",
]

function toItems(entries: [string, string][]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, [k, v]) => {
    acc[k] = v
    return acc
  }, {})
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
  const set = <K extends keyof ScadenzaFilterState>(
    key: K,
    value: ScadenzaFilterState[K],
  ) => onChange({ ...filters, [key]: value })

  const proprietarioOptions: [string, string][] = [
    ["all", "Tutti i proprietari"],
    ...mockProprietariScadenza.map((p) => [p, p] as [string, string]),
  ]

  const hasActiveFilters =
    filters.search !== "" ||
    filters.proprietario !== "all" ||
    filters.scadenzaDa !== "" ||
    filters.scadenzaA !== ""

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

      {/* Pannello filtri avanzati (funnel) */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label="Filtri avanzati" className="bg-card">
              <IconFilter size={16} stroke={1.8} />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Filtri avanzati</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-auto py-1">
            {ADVANCED_FIELDS.map((field) => (
              <button
                key={field}
                type="button"
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
              >
                {field}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        items={toItems(proprietarioOptions)}
        value={filters.proprietario}
        onValueChange={(v) => set("proprietario", v ?? "")}
      >
        <SelectTrigger className="w-[200px] bg-card" aria-label="Filtra per Proprietario">
          <SelectValue placeholder="Proprietario" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {proprietarioOptions.map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

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
