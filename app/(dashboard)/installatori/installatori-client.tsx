"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import { IconSettings } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useIsMobile } from "@/hooks/use-is-mobile"
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
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import {
  InstallatoreSearchInput,
  DEFAULT_INSTALLATORE_FILTERS,
  type InstallatoreFilterState,
} from "@/components/installatori/installatore-filters"
import { InstallatoreFiltersDrawer } from "@/components/installatori/installatore-filters-drawer"
import { InstallatoreTable } from "@/components/installatori/installatore-table"
import { InstallatoreActionsMenu } from "@/components/installatori/installatore-actions-menu"
import { BulkEmailDialog } from "@/components/shared/bulk-email-dialog"
import { BulkEmailBarButton } from "@/components/shared/bulk-email-triggers"
import { BulkSelectionBar } from "@/components/shared/bulk-selection-bar"
import { InstallatoreFormDialog } from "@/components/installatori/new-installatore-dialog"
import {
  InstallatoreSettingsSheet,
  type InstallatoreSettingsSectionId,
} from "@/components/installatori/installatore-settings-sheet"
import {
  type InstallatoriListParams,
  type InstallatoriListResponse,
  type InstallatoreSortKey,
  type SortDir,
  INITIAL_PAGE_SIZE,
} from "@/lib/installatori/api-types"
import {
  installatoriKeys,
  useInstallatoriQuery,
  useDeleteInstallatore,
  useDeleteInstallatori,
  bulkUpdateInstallatori,
  BulkOperationError,
  type InstallatoreProprietario,
} from "@/lib/installatori/hooks"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "20": "20 righe",
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

interface InstallatoriClientProps {
  initialSp: string
  initialData: InstallatoriListResponse
}

export function InstallatoriClient({ initialSp, initialData }: InstallatoriClientProps) {
  const qc = useQueryClient()

  const [filters, setFilters] = useState<InstallatoreFilterState>(DEFAULT_INSTALLATORE_FILTERS)
  const [sortBy, setSortBy] = useState<InstallatoreSortKey | null>("nome")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(INITIAL_PAGE_SIZE)
  const isMobile = useIsMobile()
  const mobileDefaultApplied = useRef(false)
  useEffect(() => {
    if (isMobile && !mobileDefaultApplied.current && rowsPerPage === INITIAL_PAGE_SIZE) {
      mobileDefaultApplied.current = true
      setRowsPerPage(20)
    }
  }, [isMobile, rowsPerPage])
  // Blocca lo scroll della pagina su mobile: stesso fix già applicato a
  // Lead/Clienti, resta scrollabile solo la lista. Nessun effetto su desktop.
  useEffect(() => {
    if (!isMobile) return
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    const prevBodyOverscroll = document.body.style.overscrollBehavior
    html.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    document.body.style.overscrollBehavior = "none"
    return () => {
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [isMobile])
  // Altezza disponibile: calcolata solo su mobile, per non alterare in alcun
  // modo il comportamento (pagina intera che scrolla) su desktop.
  const rootRef = useRef<HTMLDivElement>(null)
  const [availH, setAvailH] = useState<number | null>(null)
  useEffect(() => {
    if (!isMobile) {
      setAvailH(null)
      return
    }
    const el = rootRef.current
    if (!el) return
    const BOTTOM_GAP = 24
    const measure = () => {
      const top = el.getBoundingClientRect().top
      const next = Math.max(360, window.innerHeight - top - BOTTOM_GAP)
      setAvailH(next)
    }
    measure()
    window.addEventListener("resize", measure)
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => {
      window.removeEventListener("resize", measure)
      ro.disconnect()
    }
  }, [isMobile])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<InstallatoreRecord | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InstallatoreRecord | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<InstallatoreSettingsSectionId>("proprietari")

  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const params = useMemo<InstallatoriListParams>(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy: sortBy ?? null,
      sortDir,
      search: debouncedSearch,
      proprietario: filters.proprietario,
      tag: filters.tag,
      stato: filters.stato,
    }),
    [page, rowsPerPage, sortBy, sortDir, filters, debouncedSearch],
  )

  const { data, isFetching } = useInstallatoriQuery(params, { sp: initialSp, data: initialData })

  const pageRows = data?.rows ?? initialData.rows
  const total = data?.total ?? initialData.total
  const absoluteTotal = data?.absoluteTotal ?? initialData.absoluteTotal
  const attiviTotal = data?.attiviTotal ?? initialData.attiviTotal
  const nonAttiviTotal = data?.nonAttiviTotal ?? initialData.nonAttiviTotal
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, total)

  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.proprietario !== "all" ||
    filters.tag !== "all" ||
    filters.stato !== "all"

  const isAttivoFilterActive = filters.stato === "attivo"
  const isNonAttivoFilterActive = filters.stato === "non_attivo"

  const deleteSingle = useDeleteInstallatore()
  const deleteBulk = useDeleteInstallatori()

  const handleFilterChange = (next: InstallatoreFilterState) => {
    setFilters(next)
    setPage(1)
    setSelected(new Set())
  }

  const handleReset = () => {
    setFilters(DEFAULT_INSTALLATORE_FILTERS)
    setPage(1)
    setSelected(new Set())
  }

  const applyQuickFilter = (next: Partial<InstallatoreFilterState>) => {
    setFilters({ ...DEFAULT_INSTALLATORE_FILTERS, ...next })
    setPage(1)
    setSelected(new Set())
  }

  const handleSort = (col: InstallatoreSortKey) => {
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
      const allOnPage = pageRows.every((i) => prev.has(i.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((i) => next.delete(i.id))
      else pageRows.forEach((i) => next.add(i.id))
      return next
    })

  const handleBulkError = (error: unknown, fallback: string) => {
    qc.invalidateQueries({ queryKey: installatoriKeys.lists() })
    toast.error(error instanceof BulkOperationError ? error.message : fallback)
  }

  const handleBulkTransfer = async (owner: InstallatoreProprietario) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateInstallatori(ids, { proprietario_id: owner.id })
      qc.invalidateQueries({ queryKey: installatoriKeys.lists() })
      toast.success("Proprietario aggiornato", {
        description: `${n} installatori assegnati a ${owner.nome}.`,
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
        toast.success("Installatori eliminati", { description: `${n} installatori rimossi.` })
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
    <div
      ref={rootRef}
      className="flex min-w-0 flex-col gap-2.5 lg:h-auto lg:gap-5 lg:overflow-visible"
      style={availH ? { height: availH, overflow: "hidden" } : undefined}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">Installatori</h1>
          <p className="break-words text-sm text-muted-foreground">
            {total.toLocaleString("it-IT")} installatori
            {isFetching && (
              <span className="ml-2 text-xs text-muted-foreground/60">Aggiornamento…</span>
            )}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-1.5 lg:flex lg:w-auto lg:flex-wrap lg:justify-end lg:gap-2">
          <InstallatoreSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            trigger={
              <Button
                variant="outline"
                aria-label="Impostazioni installatori"
                className="h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-10 lg:p-0 lg:text-sm"
              >
                <IconSettings size={22} stroke={1.8} className="lg:size-[18px]" />
                <span className="lg:hidden">Imposta</span>
              </Button>
            }
          />

          <InstallatoreActionsMenu
            selectedCount={selected.size}
            onBulkTransfer={handleBulkTransfer}
            onBulkEmail={() => setBulkEmailOpen(true)}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <InstallatoreFiltersDrawer
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            trigger={({ onClick, count }) => (
              <Button
                onClick={onClick}
                className="relative h-11 w-full gap-1.5 bg-primary px-2 text-xs text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
              >
                <SlidersHorizontal className="size-[22px] lg:size-4" />
                Filtri
                {count > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1 text-xs font-bold tabular-nums text-teal-foreground">
                    {count}
                  </span>
                ) : null}
              </Button>
            )}
          />

          <Button
            className="h-11 w-full gap-1.5 bg-teal px-2 text-xs text-teal-foreground hover:bg-teal/90 lg:h-10 lg:w-auto lg:gap-2 lg:px-3.5 lg:text-sm"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="size-[22px] lg:size-4" />
            <span className="lg:hidden">Nuovo</span>
            <span className="hidden lg:inline">Nuovo installatore</span>
          </Button>
        </div>
      </div>

      {/* Barra di ricerca — sempre su una riga; il resto dei filtri vive nel drawer "Filtri" */}
      <div className="flex min-w-0 flex-row items-center gap-2 rounded-lg border border-border bg-card p-1 shadow-sm lg:p-2">
        <InstallatoreSearchInput
          value={filters.search}
          onChange={(v) => handleFilterChange({ ...filters, search: v })}
        />
      </div>

      {/* Statistiche: su mobile non servono (occupano spazio prezioso sopra
          una lista che va già consultata scrollando), restano identiche da
          lg in su. */}
      <div className="hidden gap-3 xl:grid-cols-3 lg:grid">
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
          <p className="mt-1 text-sm font-medium text-slate-600">installatori totali</p>
        </button>

        <button
          type="button"
          onClick={() => applyQuickFilter({ stato: "attivo" })}
          className={cn(
            "rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            isAttivoFilterActive && "ring-2 ring-emerald-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Operativi
            </span>
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-emerald-700">
            {attiviTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">attivi</p>
        </button>

        <button
          type="button"
          onClick={() => applyQuickFilter({ stato: "non_attivo" })}
          className={cn(
            "rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
            isNonAttivoFilterActive && "ring-2 ring-slate-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
              Fermi
            </span>
            <CircleSlash className="size-5 text-slate-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-slate-700">
            {nonAttiviTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">non attivi</p>
        </button>
      </div>

      {!isFetching && total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <p className="text-base font-medium text-foreground">Nessun installatore trovato</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova a modificare i filtri o crea il primo installatore.
          </p>
          <Button
            className="mt-4 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuovo installatore
          </Button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-visible [-webkit-overflow-scrolling:touch]">
            <InstallatoreTable
              installatori={pageRows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onEdit={(i) => setEditTarget(i)}
              onDelete={(i) => setDeleteTarget(i)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </div>

          <div className="sticky bottom-0 z-30 -mx-5 flex shrink-0 items-center justify-between gap-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:static lg:mx-0 lg:flex-wrap lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="hidden truncate text-sm text-muted-foreground lg:inline">
                {rangeStart}–{rangeEnd} di {total.toLocaleString("it-IT")}
                {selected.size > 0 ? ` · ${selected.size} selezionati` : ""}
              </span>
              <span className="truncate text-xs text-muted-foreground lg:hidden">
                {rangeStart}-{rangeEnd}/{total.toLocaleString("it-IT")}
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
                <SelectTrigger className="h-8 w-[92px] shrink-0 bg-card text-xs lg:w-[120px] lg:text-sm">
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

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
                <span className="hidden lg:inline">Precedente</span>
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
                <span className="hidden lg:inline">Successivo</span>
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
            <DialogTitle>Elimina installatore</DialogTitle>
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
                    toast.success("Installatore eliminato", { description: nome })
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
            <DialogTitle>Elimina installatori selezionati</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{selected.size} installatori</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" disabled={deleteBulk.isPending} onClick={confirmBulkDelete}>
              Elimina {selected.size} installatori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barra azioni di massa (in basso, sulla selezione) */}
      <BulkSelectionBar
        count={selected.size}
        singolare="installatore selezionato"
        plurale="installatori selezionati"
        onClear={() => setSelected(new Set())}
      >
        <BulkEmailBarButton
          selectedCount={selected.size}
          onSelect={() => setBulkEmailOpen(true)}
        />
      </BulkSelectionBar>

      {/* Dialog invio email di massa */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        recordTipo="installatore"
        recordIds={selectedIds}
      />

      <InstallatoreFormDialog open={newOpen} onOpenChange={setNewOpen} />
      <InstallatoreFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        installatore={editTarget ?? undefined}
      />
    </div>
  )
}
