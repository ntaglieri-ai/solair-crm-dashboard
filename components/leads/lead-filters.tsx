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
  SEDI,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_LABELS,
  LEAD_ORIGINI,
  MOCK_COMMERCIALI,
} from "@/lib/mock-data"

export type ScoreFilter = "all" | "caldo" | "medio" | "freddo"

export interface LeadFilterState {
  search: string
  stato: string
  sede: string
  commerciale: string
  origine: string
  score: ScoreFilter
}

export const DEFAULT_FILTERS: LeadFilterState = {
  search: "",
  stato: "all",
  sede: "all",
  commerciale: "all",
  origine: "all",
  score: "all",
}

function toItems(entries: [string, string][]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, [k, v]) => {
    acc[k] = v
    return acc
  }, {})
}

const STATO_ITEMS = toItems([
  ["all", "Tutti gli stati"],
  ...LEAD_STATUS_ORDER.map(
    (s) => [s, LEAD_STATUS_LABELS[s]] as [string, string],
  ),
])

const SEDE_ITEMS = toItems([
  ...SEDI.map((s) => [s.id, s.label] as [string, string]),
])

const COMMERCIALE_ITEMS = toItems([
  ["all", "Tutti i commerciali"],
  ...MOCK_COMMERCIALI.map((c) => [c, c] as [string, string]),
])

const ORIGINE_ITEMS = toItems([
  ["all", "Tutte le origini"],
  ...LEAD_ORIGINI.map((o) => [o, o] as [string, string]),
])

const SCORE_ITEMS = toItems([
  ["all", "Tutti gli score"],
  ["caldo", "Caldo (>80)"],
  ["medio", "Medio (50-80)"],
  ["freddo", "Freddo (<50)"],
])

export function LeadFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: LeadFilterState
  onChange: (next: LeadFilterState) => void
  onReset: () => void
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
        />
      </div>

      <Select
        items={STATO_ITEMS}
        value={filters.stato}
        onValueChange={(v) => set("stato", v)}
      >
        <SelectTrigger className="w-[170px] bg-card">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(STATO_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={SEDE_ITEMS}
        value={filters.sede}
        onValueChange={(v) => set("sede", v)}
      >
        <SelectTrigger className="w-[160px] bg-card">
          <SelectValue placeholder="Sede" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {SEDI.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={COMMERCIALE_ITEMS}
        value={filters.commerciale}
        onValueChange={(v) => set("commerciale", v)}
      >
        <SelectTrigger className="w-[180px] bg-card">
          <SelectValue placeholder="Commerciale" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(COMMERCIALE_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={ORIGINE_ITEMS}
        value={filters.origine}
        onValueChange={(v) => set("origine", v)}
      >
        <SelectTrigger className="w-[160px] bg-card">
          <SelectValue placeholder="Origine" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(ORIGINE_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        items={SCORE_ITEMS}
        value={filters.score}
        onValueChange={(v) => set("score", v as ScoreFilter)}
      >
        <SelectTrigger className="w-[160px] bg-card">
          <SelectValue placeholder="Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(SCORE_ITEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

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
