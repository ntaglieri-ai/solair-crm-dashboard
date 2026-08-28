"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import {
  IconSettings,
  IconList,
  IconLayoutKanban,
} from "@tabler/icons-react"
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
import { type Compito, type StatoCompito, OPEN_TASK_STATI } from "@/lib/mock-data"
import {
  buildKanbanDoneParams,
  buildKanbanOpenParams,
  KANBAN_OPEN_PAGE_SIZE,
} from "@/lib/compiti/api-types"
import {
  CompitoSearchInput,
  DEFAULT_COMPITO_FILTERS,
  type CompitoFilterState,
} from "@/components/compiti/compito-filters"
import { CompitoFiltersDrawer } from "@/components/compiti/compito-filters-drawer"
import {
  CompitoTable,
  type CompitoSortKey,
  type SortDir,
} from "@/components/compiti/compito-table"
import { CompitoKanban } from "@/components/compiti/compito-kanban"
import { CompitoActionsMenu } from "@/components/compiti/compito-actions-menu"
import { NewCompitoDialog } from "@/components/compiti/new-compito-dialog"
import {
  CompitoSettingsSheet,
  type CompitoSettingsSectionId,
} from "@/components/compiti/compito-settings-sheet"
import {
  type CompitiListParams,
  type CompitiListResponse,
  INITIAL_PAGE_SIZE,
} from "@/lib/compiti/api-types"
import {
  compitiKeys,
  useCompitiQuery,
  useCreateCompito,
  useDeleteCompito,
  useDeleteCompiti,
  useUpdateCompito,
  bulkUpdateCompiti,
  BulkOperationError,
  type CompitoProprietario,
} from "@/lib/compiti/hooks"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "20": "20 righe",
  "30": "30 righe",
  "50": "50 righe",
}

type ViewMode = "lista" | "kanban"

// Ritarda la propagazione del valore: l'input resta controllato e immediato,
// la query parte solo dopo 300ms di pausa nella digitazione.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

type KanbanInitial = { sp: string; data: CompitiListResponse }

interface CompitiClientProps {
  initialSp: string
  initialData: CompitiListResponse
  /** Colonne aperte della kanban precaricate dal server (vista predefinita). */
  initialKanbanOpen: KanbanInitial
  /** Colonna "Completato" precaricata dal server. */
  initialKanbanDone: KanbanInitial
}

export function CompitiClient({
  initialSp,
  initialData,
  initialKanbanOpen,
  initialKanbanDone,
}: CompitiClientProps) {
  const qc = useQueryClient()

  // --- Filter / sort / pagination state ---
  const [filters, setFilters] = useState<CompitoFilterState>(DEFAULT_COMPITO_FILTERS)
  const [sortBy, setSortBy] = useState<CompitoSortKey | null>("Data di scadenza")
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
  // Lead/Clienti/Installatori, resta scrollabile solo la lista. Nessun
  // effetto su desktop.
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

  // --- UI state ---
  const [view, setView] = useState<ViewMode>("kanban")
  // Su mobile la vista kanban (colonne affiancate, scroll orizzontale) non è
  // usabile: forziamo sempre la lista, senza toccare la preferenza salvata
  // dall'utente per il desktop.
  const effectiveView: ViewMode = isMobile ? "lista" : view
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newOpen, setNewOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Compito | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<CompitoSettingsSectionId>("stati")

  // --- Build server-side query params ---
  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const params = useMemo<CompitiListParams>(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy: sortBy ?? null,
      sortDir,
      search: debouncedSearch,
      stati: filters.stati,
      priorita: filters.priorita,
      proprietario: filters.proprietario,
      sede: filters.sede,
      scadenzaDa: filters.scadenzaDa,
      scadenzaA: filters.scadenzaA,
      overdue: filters.overdue,
    }),
    [page, rowsPerPage, sortBy, sortDir, filters, debouncedSearch],
  )

  const { data, isFetching } = useCompitiQuery(params, {
    sp: initialSp,
    data: initialData,
  })

  // --- Query dedicate alla kanban, indipendenti dalla paginazione della lista.
  // La board mostra sempre i compiti aperti più urgenti (fino a 200) e le
  // chiusure più recenti, applicando i filtri della barra (ricerca, priorità,
  // proprietario, sede, date). Gli stati sono fissati per colonna.
  const kanbanFilters = useMemo(
    () => ({
      search: debouncedSearch,
      priorita: filters.priorita,
      proprietario: filters.proprietario,
      sede: filters.sede,
      scadenzaDa: filters.scadenzaDa,
      scadenzaA: filters.scadenzaA,
      overdue: filters.overdue,
    }),
    [debouncedSearch, filters],
  )
  const kanbanOpenParams = useMemo(
    () => buildKanbanOpenParams(kanbanFilters, [...OPEN_TASK_STATI]),
    [kanbanFilters],
  )
  const kanbanDoneParams = useMemo(
    () => buildKanbanDoneParams(kanbanFilters),
    [kanbanFilters],
  )
  // initialData dal server: la bacheca nasce popolata invece di dichiarare zero
  // per mezzo secondo. Il gancio lo applica solo se la chiave coincide, quindi
  // appena l'utente filtra o cerca si torna alla fetch normale.
  const { data: kanbanOpenData } = useCompitiQuery(kanbanOpenParams, initialKanbanOpen, {
    enabled: effectiveView === "kanban",
  })
  const { data: kanbanDoneData } = useCompitiQuery(kanbanDoneParams, initialKanbanDone, {
    enabled: effectiveView === "kanban",
  })
  const kanbanRows = useMemo(
    () => [...(kanbanOpenData?.rows ?? []), ...(kanbanDoneData?.rows ?? [])],
    [kanbanOpenData, kanbanDoneData],
  )
  const kanbanOpenTruncated =
    (kanbanOpenData?.total ?? 0) > KANBAN_OPEN_PAGE_SIZE

  const pageRows = data?.rows ?? initialData.rows
  const absoluteTotal =
    data?.absoluteTotal ?? initialData.absoluteTotal ?? data?.total ?? initialData.total
  const total = data?.total ?? initialData.total
  const scadutiTotal = data?.scadutiTotal ?? initialData.scadutiTotal
  const overdueTotal = data?.overdueTotal ?? initialData.overdueTotal ?? scadutiTotal
  const highPriorityTotal =
    data?.highPriorityTotal ?? initialData.highPriorityTotal ?? 0
  const openTotal = data?.openTotal ?? initialData.openTotal ?? 0
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, total)
  const hasOpenStateFilter =
    filters.stati.length === OPEN_TASK_STATI.length &&
    OPEN_TASK_STATI.every((stato) => filters.stati.includes(stato))
  const isOverdueFilterActive = hasOpenStateFilter && filters.overdue
  const isHighPriorityFilterActive = filters.priorita === "Alto"
  const isOpenFilterActive = hasOpenStateFilter && !filters.overdue
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.stati.length > 0 ||
    filters.priorita !== "all" ||
    filters.proprietario !== "all" ||
    filters.sede !== "all" ||
    Boolean(filters.scadenzaDa) ||
    Boolean(filters.scadenzaA) ||
    filters.overdue

  // --- Mutations ---
  const createCompito = useCreateCompito()
  const deleteSingle = useDeleteCompito()
  const deleteBulk = useDeleteCompiti()
  const updateCompito = useUpdateCompito()

  // --- Handlers ---
  const handleFilterChange = (next: CompitoFilterState) => {
    setFilters(next)
    setPage(1)
    setSelected(new Set())
  }

  const handleReset = () => {
    setFilters(DEFAULT_COMPITO_FILTERS)
    setPage(1)
    setSelected(new Set())
  }

  const applyQuickFilter = (next: Partial<CompitoFilterState>) => {
    setFilters({ ...DEFAULT_COMPITO_FILTERS, ...next })
    setPage(1)
    setSelected(new Set())
  }

  const showOverdueTasks = () => {
    applyQuickFilter({
      stati: OPEN_TASK_STATI,
      overdue: true,
    })
  }

  const showHighPriorityTasks = () => {
    applyQuickFilter({
      priorita: "Alto",
    })
  }

  const showOpenTasks = () => {
    applyQuickFilter({
      stati: OPEN_TASK_STATI,
    })
  }

  const handleSort = (col: CompitoSortKey) => {
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
      const allOnPage = pageRows.every((c) => prev.has(c.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((c) => next.delete(c.id))
      else pageRows.forEach((c) => next.add(c.id))
      return next
    })

  const handleCreate = (compito: Compito) => {
    createCompito.mutate(compito, {
      onSuccess: () => {
        toast.success("Compito creato", { description: compito.Oggetto })
        setPage(1)
      },
      onError: () => toast.error("Errore nella creazione del compito"),
    })
  }

  const completaCompito = (id: string) => {
    updateCompito.mutate(
      { id, patch: { Stato: "Completato" as StatoCompito } },
      { onError: () => toast.error("Errore nel completamento") },
    )
  }

  const handleMove = (id: string, stato: StatoCompito) => {
    updateCompito.mutate(
      { id, patch: { Stato: stato } },
      { onError: () => toast.error("Errore nello spostamento") },
    )
  }

  // Fallimento parziale: invalida comunque (alcune righe sono cambiate) e
  // mostra il conteggio degli errori.
  const handleBulkError = (error: unknown, fallback: string) => {
    qc.invalidateQueries({ queryKey: compitiKeys.lists() })
    toast.error(
      error instanceof BulkOperationError ? error.message : fallback,
    )
  }

  const handleBulkTransfer = async (owner: CompitoProprietario) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateCompiti(ids, {
        "Proprietario del compito": owner.nome,
        "Proprietario del compito.id": owner.zoho_id,
      })
      qc.invalidateQueries({ queryKey: compitiKeys.lists() })
      toast.success("Proprietario aggiornato", {
        description: `${n} compiti assegnati a ${owner.nome}.`,
      })
      setSelected(new Set())
    } catch (error) {
      handleBulkError(error, "Errore nell'aggiornamento del proprietario")
    }
  }

  const handleBulkStato = async (stato: StatoCompito) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateCompiti(ids, { Stato: stato })
      qc.invalidateQueries({ queryKey: compitiKeys.lists() })
      toast.success("Stato aggiornato", {
        description: `${n} compiti impostati su "${stato}".`,
      })
      setSelected(new Set())
    } catch (error) {
      handleBulkError(error, "Errore nell'aggiornamento dello stato")
    }
  }

  const handleBulkComplete = async () => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateCompiti(ids, { Stato: "Completato" as StatoCompito })
      qc.invalidateQueries({ queryKey: compitiKeys.lists() })
      toast.success("Compiti completati", { description: `${n} compiti chiusi.` })
      setSelected(new Set())
    } catch (error) {
      handleBulkError(error, "Errore nel completamento")
    }
  }

  const confirmBulkDelete = () => {
    const ids = Array.from(selected)
    const n = ids.length
    deleteBulk.mutate(ids, {
      onSuccess: () => {
        toast.success("Compiti eliminati", { description: `${n} compiti rimossi.` })
        setBulkDeleteOpen(false)
        setSelected(new Set())
      },
      // Le query vengono già invalidate da onSettled del hook.
      onError: (error) =>
        toast.error(
          error instanceof BulkOperationError
            ? error.message
            : "Errore nell'eliminazione",
        ),
    })
  }

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-col gap-5 lg:h-auto lg:overflow-visible"
      style={availH ? { height: availH, overflow: "hidden" } : undefined}
    >
      {/* Header pagina */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">
            Compiti
          </h1>
          <p className="break-words text-sm text-muted-foreground">
            {total.toLocaleString("it-IT")} compiti · {scadutiTotal} in scadenza
            {isFetching && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                Aggiornamento…
              </span>
            )}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2.5 lg:flex lg:w-auto lg:flex-wrap lg:justify-end lg:gap-2">
          {/* Toggle Lista / Kanban: su mobile la vista è sempre lista, il
              toggle non serve — resta identico da lg in su. */}
          <div className="col-span-2 hidden items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 lg:flex">
            <button
              type="button"
              aria-label="Vista Lista"
              aria-pressed={view === "lista"}
              onClick={() => setView("lista")}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                view === "lista"
                  ? "bg-navy text-navy-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <IconList size={18} stroke={1.8} />
            </button>
            <button
              type="button"
              aria-label="Vista Kanban"
              aria-pressed={view === "kanban"}
              onClick={() => setView("kanban")}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                view === "kanban"
                  ? "bg-navy text-navy-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <IconLayoutKanban size={18} stroke={1.8} />
            </button>
          </div>

          <CompitoSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            trigger={
              <Button
                variant="outline"
                aria-label="Impostazioni compiti"
                className="h-14 w-full gap-2 bg-card text-sm lg:h-10 lg:w-10 lg:p-0"
              >
                <IconSettings size={22} stroke={1.8} className="lg:size-[18px]" />
                <span className="lg:hidden">Imposta</span>
              </Button>
            }
          />

          <CompitoActionsMenu
            selectedCount={selected.size}
            onBulkTransfer={handleBulkTransfer}
            onBulkStato={handleBulkStato}
            onBulkComplete={handleBulkComplete}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <CompitoFiltersDrawer
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            trigger={({ onClick, count }) => (
              <Button
                onClick={onClick}
                className="relative h-14 w-full gap-2 bg-primary text-sm text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90 lg:h-10 lg:w-auto"
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
            className="h-14 w-full gap-2 bg-teal text-sm text-teal-foreground hover:bg-teal/90 lg:h-10 lg:w-auto"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="size-[22px] lg:size-4" />
            <span className="lg:hidden">Nuovo</span>
            <span className="hidden lg:inline">Crea Compito</span>
          </Button>
        </div>
      </div>

      {/* Statistiche: su mobile non servono (occupano spazio prezioso sopra
          una lista che va già consultata scrollando), restano identiche da
          lg in su. */}
      <div className="hidden gap-3 lg:grid xl:grid-cols-4">
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
              Carico operativo
            </span>
            <Sparkles className="size-5 text-blue-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-slate-950">
            {absoluteTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            task totali
          </p>
        </button>
        <button
          type="button"
          onClick={showOverdueTasks}
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
            {overdueTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            scaduti non completati
          </p>
        </button>
        <button
          type="button"
          onClick={showHighPriorityTasks}
          className={cn(
            "rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
            isHighPriorityFilterActive && "ring-2 ring-amber-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              Priorità
            </span>
            <CalendarClock className="size-5 text-amber-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-amber-700">
            {highPriorityTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            mostra priorità alta
          </p>
        </button>
        <button
          type="button"
          onClick={showOpenTasks}
          className={cn(
            "rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            isOpenFilterActive && "ring-2 ring-emerald-300",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
              Avanzamento
            </span>
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <p className="mt-4 text-4xl font-black tabular-nums text-emerald-700">
            {openTotal.toLocaleString("it-IT")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            mostra task aperti
          </p>
        </button>
      </div>

      {/* Barra di ricerca — sempre su una riga; il resto dei filtri vive nel drawer "Filtri" */}
      <div className="flex min-w-0 flex-row items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
        <CompitoSearchInput
          value={filters.search}
          onChange={(v) => handleFilterChange({ ...filters, search: v })}
        />
      </div>

      {/* Empty state */}
      {!isFetching && total === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <p className="text-base font-medium text-foreground">
            Nessun compito trovato
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova a modificare i filtri o crea il primo compito.
          </p>
          <Button
            className="mt-4 bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Crea Compito
          </Button>
        </div>
      )}

      {/* Vista */}
      {total > 0 && effectiveView === "lista" ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-visible [-webkit-overflow-scrolling:touch]">
            <CompitoTable
              compiti={pageRows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onComplete={(c) => {
                completaCompito(c.id)
                toast.success("Compito completato", { description: c.Oggetto })
              }}
              onDelete={(c) => setDeleteTarget(c)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </div>

          {/* Footer paginazione — sticky solo su mobile, in flusso normale da lg in su */}
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
      ) : total > 0 && effectiveView === "kanban" ? (
        <>
          {kanbanOpenTruncated && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Mostrati i 200 compiti aperti più urgenti — usa la vista Lista o
              i filtri per vedere tutto.
            </div>
          )}
          <CompitoKanban compiti={kanbanRows} onMove={handleMove} />
        </>
      ) : null}

      {/* Dialog elimina singolo */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina compito</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.Oggetto ?? ""}
              </span>
              ? L&apos;azione non può essere annullata.
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
                const nome = deleteTarget.Oggetto
                deleteSingle.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Compito eliminato", { description: nome })
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

      {/* Dialog elimina bulk */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina compiti selezionati</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {selected.size} compiti
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              disabled={deleteBulk.isPending}
              onClick={confirmBulkDelete}
            >
              Elimina {selected.size} compiti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCompitoDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={handleCreate}
      />
    </div>
  )
}
