"use client"

import { useState } from "react"
import { Search, X, Plus, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  SEDE_LABELS,
} from "@/lib/mock-data"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { useStatoClienteQuery, useCreateStatoCliente } from "@/lib/clienti/stato-cliente-store"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import { EMPTY_FILTER_VALUE, hasFilterValues } from "@/lib/shared/filter-values"
import { option } from "@/lib/crm-settings/column-values"
import { useColumnValueOptions } from "@/lib/crm-settings/use-column-values"

export interface ClienteFilterState {
  search: string
  stato: string[]
  sede: string[]
  proprietario: string[]
  installatore: string[]
  tag: string[]
}

export const DEFAULT_CLIENTE_FILTERS: ClienteFilterState = {
  search: "",
  stato: [],
  sede: [],
  proprietario: [],
  installatore: [],
  tag: [],
}

/**
 * Report Vito (5) + richiesta Nando 04/09: "solo quelli Zoho e la
 * possibilita' di crearne". Non nel dialog di modifica/creazione cliente
 * (troppi punti da duplicare) — qui nel filtro, un solo posto visibile,
 * riservato a chi gestisce lo schema (stessa soglia dei Campi personalizzati).
 */
function AggiungiStatoPopover() {
  const [open, setOpen] = useState(false)
  const [valore, setValore] = useState("")
  const createStato = useCreateStatoCliente()

  const submit = () => {
    const trimmed = valore.trim()
    if (!trimmed) return
    createStato.mutate(trimmed, {
      onSuccess: () => {
        toast.success(`Stato "${trimmed}" creato`)
        setValore("")
        setOpen(false)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Creazione non riuscita")
      },
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 border-dashed"
            aria-label="Aggiungi nuovo stato"
          />
        }
      >
        <Plus className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Nuovo stato cliente</p>
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Nome stato"
            className="h-8"
          />
          <Button
            type="button"
            size="icon"
            className="size-8 shrink-0"
            disabled={!valore.trim() || createStato.isPending}
            onClick={submit}
          >
            {createStato.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function countActiveClienteFilters(filters: ClienteFilterState): number {
  return (
    (hasFilterValues(filters.stato) ? 1 : 0) +
    (hasFilterValues(filters.sede) ? 1 : 0) +
    (hasFilterValues(filters.proprietario) ? 1 : 0) +
    (hasFilterValues(filters.installatore) ? 1 : 0) +
    (hasFilterValues(filters.tag) ? 1 : 0)
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
  const { owners, installerNames, tags } = useClienteTags()
  const { data: statoOptions } = useStatoClienteQuery()
  const sedeOptions = useColumnValueOptions(
    "Clienti",
    "sede",
    SEDE_LABELS.map((s) => option(s)),
    { includeFallback: true },
  ).options

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-1.5">
          <MultiFilterSelect
            ariaLabel="Filtra per Stato"
            className="w-full bg-card"
            value={filters.stato}
            onValueChange={(v) => set("stato", v)}
            allLabel="Tutti gli stati"
            options={[
              ...(statoOptions ?? []).map((s) => ({ value: s.valore, label: s.valore })),
              { value: EMPTY_FILTER_VALUE, label: "Vuoto" },
            ]}
          />
          <AggiungiStatoPopover />
        </div>

        <MultiFilterSelect
          ariaLabel="Filtra per Sede"
          className="w-full bg-card"
          value={filters.sede}
          onValueChange={(v) => set("sede", v)}
          allLabel="Tutte le sedi"
          options={sedeOptions}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Clienti Proprietario"
          className="w-full bg-card"
          value={filters.proprietario}
          onValueChange={(v) => set("proprietario", v)}
          allLabel="Tutti i proprietari"
          options={[
            // value = id (UUID): il server filtra su clienti_proprietario_id,
            // non sul nome — mandare il nome non avrebbe mai potuto matchare.
            ...owners.map((o) => ({ value: o.id, label: o.nome })),
          ]}
        />

        <MultiFilterSelect
          ariaLabel="Filtra per Installatore"
          className="w-full bg-card"
          value={filters.installatore}
          onValueChange={(v) => set("installatore", v)}
          allLabel="Tutti gli installatori"
          options={[
            // Nomi distinti REALI presenti sui clienti (colonna testo), non
            // l'anagrafica installatori: e' quella colonna a essere
            // confrontata dal filtro server.
            ...installerNames.map((i) => ({ value: i, label: i })),
          ]}
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
