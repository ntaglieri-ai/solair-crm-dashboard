"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react"
import { IconSettings } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import {
  ScadenzaFilters,
  DEFAULT_SCADENZA_FILTERS,
  type ScadenzaFilterState,
} from "@/components/scadenze/scadenza-filters"
import { ScadenzaTable } from "@/components/scadenze/scadenza-table"
import { ScadenzaActionsMenu } from "@/components/scadenze/scadenza-actions-menu"
import { ScadenzaFormDialog } from "@/components/scadenze/scadenza-form-dialog"
import {
  ScadenzaSettingsSheet,
  type ScadenzaSettingsSectionId,
} from "@/components/scadenze/scadenza-settings-sheet"
import {
  type ScadenzeListParams,
  type ScadenzeListResponse,
  type ScadenzaSortKey,
  type SortDir,
  INITIAL_PAGE_SIZE,
} from "@/lib/scadenze/api-types"
import {
  scadenzeKeys,
  useScadenzeQuery,
  useDeleteScadenza,
  useDeleteScadenze,
  bulkUpdateScadenze,
  BulkOperationError,
  type ScadenzaProprietario,
} from "@/lib/scadenze/hooks"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function todayISO(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

interface ScadenzeClientProps {
  initialSp: string
  initialData: ScadenzeListResponse
}

export function ScadenzeClient({ initialSp, initialData }: ScadenzeClientProps) {
  const qc = useQueryClient()

  const [filters, setFilters] = useState<ScadenzaFilterState>(DEFAULT_SCADENZA_FILTERS)
  const [sortBy, setSortBy] = useState<ScadenzaSortKey | null>("data_scadenza")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(INITIAL_PAGE_SIZE)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScadenzaRecord | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScadenzaRecord | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<ScadenzaSettingsSectionId>("proprietari")

  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const params = useMemo<ScadenzeListParams>(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy: sortBy ?? null,
      sortDir,
      search: debouncedSearch,
      proprietario: filters.proprietario,
      tag: filters.tag,
      scadenzaDa: filters.scadenzaDa,
      scadenzaA: filters.scadenzaA,
      collegamento: filters.collegamento,
    }),
    [page, rowsPerPage, sortBy, sortDir, filters, debouncedSearch],
  )

  const { data, isFetching } = useScadenzeQuery(params, { sp: initialSp, data: initialData })

  const pageRows = data?.rows ?? initialData.rows
  const total = data?.total ?? initialData.total
  const absoluteTotal = data?.absoluteTotal ?? initialData.absoluteTotal
  const scaduteTotal = data?.scaduteTotal ?? initialData.scaduteTotal
  const prossimi7Total = data?.prossimi7Total ?? initialData.prossimi7Total
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, total)

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.proprietario !== "all" ||
    filters.tag !== "all" ||
    Boolean(filters.scadenzaDa) ||
    Boolean(filters.scadenzaA) ||
    filters.collegamento !== "all"

  const isOverdueFilterActive = filters.scadenzaDa === "" && filters.scadenzaA === todayISO()
  const isNext7FilterActive =
    filters.scadenzaDa === todayISO() && filters.scadenzaA === todayISO(7)

  const deleteSingle = useDeleteScadenza()
  const deleteBulk = useDeleteScadenze()

  const handleFilterChange = (next: ScadenzaFilterState) => {
    setFilters(next)
    setPage(1)
    setSelected(new Set())
  }

  const handleReset = () => {
    setFilters(DEFAULT_SCADENZA_FILTERS)
    setPage(1)
    setSelected(new Set())
  }

  const applyQuickFilter = (next: Partial<ScadenzaFilterState>) => {
    setFilters({ ...DEFAULT_SCADENZA_FILTERS, ...next })
    setPage(1)
    setSelected(new Set())
  }

  const showOverdue = () => applyQuickFilter({ scadenzaA: todayISO() })
  const showNext7 = () => applyQuickFilter({ scadenzaDa: todayISO(), scadenzaA: todayISO(7) })

  const handleSort = (col: ScadenzaSortKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
    setPage(1)
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => {
      const allOnPage = pageRows.every((s) => prev.has(s.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((s) => next.delete(s.id))
      else pageRows.forEach((s) => next.add(s.id))
      return next
    })

  const handleBulkError = (error: unknown, fallback: string) => {
    qc.invalidateQueries({ queryKey: scadenzeKeys.lists() })
    toast.error(error instanceof BulkOperationError ? error.message : fallback)
  }

  const handleBulkTransfer = async (owner: ScadenzaProprietario) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateScadenze(ids, { proprietario_id: owner.id })
      qc.invalidateQueries({ queryKey: scadenzeKeys.lists() })
      toast.success("Proprietario aggiornato", {
        description: `${n} scadenze assegnate a ${owner.nome}.`,
      })
      setSelected(new Set())
    } catch (error) {
      handleBulkError(error, "Errore nell'aggiornamento del proprietario")
    }
  }

  const confirmBulkDelete = () => {
    const ids = Array.from(selected)
    const n = ids.length
    deleteBulk.mutate(ids, {
      onSuccess: () => {
        toast.success("Scadenze eliminate", { description: `${n} scadenze rimosse.` })
        setBulkDeleteOpen(false)
        setSelected(new Set())
      },
      onError: (error) =>
        toast.error(
          error instanceof BulkOperationError ? error.message : "Errore nell'eliminazione",
        ),
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Scadenze</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("it-IT")} scadenze
            {isFetching && (
              <span className="ml-2 text-xs text-muted-foreground/60">Aggiornamento…</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ScadenzaSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label="Impostazioni scadenze"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
              </Button>
            }
          />

          <ScadenzaActionsMenu
            selectedCount={selected.size}
            onBulkTransfer={handleBulkTransfer}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuova scadenza
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            if (hasActiveFilters) handleReset()
          }}
          aria-disabled={!hasActiveFilters}
          className={cn(
            "rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
            hasActiveFilters
              ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md ring-2 ring-blue-200"
              : "cursor-default",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Totale
            </span>
            <Sparkles className="size-5 text-blue-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-slate-950">
            {absoluteTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">scadenze totali</p>
        </button>

        <button
          type="button"
          onClick={showOverdue}
          className={cn(
            "rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
            isOverdueFilterActive && "ring-2 ring-red-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">
              Attenzione
            </span>
            <AlertTriangle className="size-5 text-red-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-red-700">
            {scaduteTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">scadute</p>
        </button>

        <button
          type="button"
          onClick={showNext7}
          className={cn(
            "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
            isNext7FilterActive && "ring-2 ring-amber-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              In arrivo
            </span>
            <CalendarClock className="size-5 text-amber-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-amber-700">
            {prossimi7Total.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">prossimi 7 giorni</p>
        </button>
      </div>

      <ScadenzaFilters filters={filters} onChange={handleFilterChange} onReset={handleReset} />

      {!isFetching && total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <p className="text-base font-medium text-foreground">Nessuna scadenza trovata</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova a modificare i filtri o crea la prima scadenza.
          </p>
          <Button
            className="mt-4 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuova scadenza
          </Button>
        </div>
      ) : (
        <>
          <ScadenzaTable
            scadenze={pageRows}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onEdit={(s) => setEditTarget(s)}
            onDelete={(s) => setDeleteTarget(s)}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {rangeStart}–{rangeEnd} di {total.toLocaleString("it-IT")}
                {selected.size > 0 ? ` · ${selected.size} selezionate` : ""}
              </span>
              <Select
                items={ROWS_ITEMS}
                value={String(rowsPerPage)}
                onValueChange={(v) => {
                  setRowsPerPage(Number(v))
                  setPage(1)
                  setSelected(new Set())
                }}
              >
                <SelectTrigger className="h-8 w-[120px] bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(ROWS_ITEMS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                disabled={page <= 1 || isFetching}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1))
                  setSelected(new Set())
                }}
              >
                <ChevronLeft data-icon="inline-start" />
                Precedente
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="bg-card"
                disabled={page >= totalPages || isFetching}
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1))
                  setSelected(new Set())
                }}
              >
                Successivo
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina scadenza</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.nome ?? ""}</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSingle.isPending}
              onClick={() => {
                if (!deleteTarget) return
                const nome = deleteTarget.nome
                deleteSingle.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Scadenza eliminata", { description: nome })
                    setDeleteTarget(null)
                  },
                  onError: () => toast.error("Errore nell'eliminazione"),
                })
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina scadenze selezionate</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{selected.size} scadenze</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" disabled={deleteBulk.isPending} onClick={confirmBulkDelete}>
              Elimina {selected.size} scadenze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScadenzaFormDialog open={newOpen} onOpenChange={setNewOpen} />
      <ScadenzaFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        scadenza={editTarget ?? undefined}
      />
    </div>
  )
}
