"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Upload,
  Download,
} from "lucide-react"
import { IconSettings } from "@tabler/icons-react"
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
  LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type Lead,
  type LeadColumnId,
} from "@/lib/mock-data"
import {
  LeadFilters,
  DEFAULT_FILTERS,
  type LeadFilterState,
} from "@/components/leads/lead-filters"
import {
  LeadTable,
  type SortDir,
  type Density,
} from "@/components/leads/lead-table"
import { BulkToolbar } from "@/components/leads/bulk-toolbar"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import {
  LeadSettingsSheet,
  type SettingsSectionId,
} from "@/components/leads/lead-settings-sheet"
import { LeadActionsMenu } from "@/components/leads/lead-actions-menu"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import {
  AdvancedFilters,
  EMPTY_ADVANCED,
  type AdvancedFilterState,
} from "@/components/leads/advanced-filters"
import {
  type LeadListParams,
  type LeadListItem,
  type LeadListResponse,
  type LeadStats,
  INITIAL_PAGE_SIZE,
} from "@/lib/leads/api-types"
import {
  useLeadsQuery,
  useLeadStats,
  useCreateLead,
  useDeleteLead,
  useUpdateLead,
  useBulkLeads,
  fetchLeadsForExport,
} from "@/lib/leads/hooks"
import { useTags } from "@/lib/tag-store"
import { usePermissions } from "@/lib/permissions/provider"
import { motion } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { leadsKeys } from "@/lib/leads/hooks"

type LeadViewPreferences = {
  version: 2
  visibleCols: LeadColumnId[]
  columnWidths: Partial<Record<LeadColumnId, number>>
  density: Density
}

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

// Simula il download di un file CSV a partire dalle righe passate
function downloadLeadsCsv(rows: LeadListItem[], filename: string) {
  const cols = LEAD_COLUMNS.map((c) => c.id)
  const header = cols.join(";")
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = (r as Record<string, unknown>)[c]
          const s = Array.isArray(v) ? v.join(", ") : String(v ?? "")
          return `"${s.replace(/"/g, '""')}"`
        })
        .join(";"),
    )
    .join("\n")
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface LeadsClientProps {
  /** Query-string del prefetch server-side (per abbinare la chiave React Query). */
  initialSp: string
  /** Prima pagina (50 righe) pre-caricata server-side. */
  initialLeads: LeadListResponse
  /** Statistiche header pre-caricate server-side. */
  initialStats: LeadStats
}

export function LeadsClient({
  initialSp,
  initialLeads,
  initialStats,
}: LeadsClientProps) {
  const { tags } = useTags()
  const permissions = usePermissions()
  const allTags = useMemo(() => tags.map((tag) => tag.name), [tags])
  const preferenceOwner =
    permissions.snapshot.subject.userId ??
    permissions.snapshot.subject.authUserId ??
    "anonymous"
  const preferenceKey = `solair:leads:view:${preferenceOwner}:v2`
  const queryClient = useQueryClient()
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilterState>(DEFAULT_FILTERS)
  const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_ADVANCED)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(INITIAL_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null)
  const [visibleCols, setVisibleCols] = useState<LeadColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS,
  )
  const [columnWidths, setColumnWidths] = useState<
    Partial<Record<LeadColumnId, number>>
  >({})
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [sortBy, setSortBy] = useState<LeadColumnId | null>("Valutazione")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [density, setDensity] = useState<Density>("normale")
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>("generali")

  const columns = useMemo(
    () =>
      visibleCols
        .map((id) => LEAD_COLUMNS.find((column) => column.id === id))
        .filter((column): column is (typeof LEAD_COLUMNS)[number] => Boolean(column)),
    [visibleCols],
  )

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const raw = window.localStorage.getItem(preferenceKey)
        if (raw) {
          const stored = JSON.parse(raw) as Partial<LeadViewPreferences>
          const validIds = new Set(LEAD_COLUMNS.map((column) => column.id))
          const order = (stored.visibleCols ?? []).filter((id) => validIds.has(id))
          if (order.length) setVisibleCols(order)
          if (stored.columnWidths) setColumnWidths(stored.columnWidths)
          if (
            stored.density === "comoda" ||
            stored.density === "normale" ||
            stored.density === "densa"
          ) {
            setDensity(stored.density)
          }
        }
      } catch {
        window.localStorage.removeItem(preferenceKey)
      } finally {
        setPreferencesLoaded(true)
      }
    })
    return () => {
      active = false
    }
  }, [preferenceKey])

  useEffect(() => {
    if (!preferencesLoaded) return
    const preferences: LeadViewPreferences = {
      version: 2,
      visibleCols,
      columnWidths,
      density,
    }
    window.localStorage.setItem(preferenceKey, JSON.stringify(preferences))
  }, [
    columnWidths,
    density,
    preferenceKey,
    preferencesLoaded,
    visibleCols,
  ])

  const reorderColumns = useCallback(
    (source: LeadColumnId, target: LeadColumnId) => {
      setVisibleCols((current) => {
        const from = current.indexOf(source)
        const to = current.indexOf(target)
        if (from < 0 || to < 0 || from === to) return current
        const next = [...current]
        next.splice(to, 0, next.splice(from, 1)[0])
        return next
      })
    },
    [],
  )

  // Ricerca con debounce: l'input resta reattivo (filters.search), ma la query
  // parte solo ~350ms dopo l'ultimo tasto, evitando un fetch a ogni carattere.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    if (debouncedSearch === filters.search) return
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [filters.search, debouncedSearch])

  // Parametri di query inviati al server (paginazione/filtri/ordinamento/proiezione).
  // Memoizzati: evitano di ricreare l'oggetto (e nuove fetch) a ogni render.
  const params: LeadListParams = useMemo(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy,
      sortDir,
      search: debouncedSearch,
      stato: filters.stato,
      sede: filters.sede,
      commerciale: filters.commerciale,
      origine: filters.origine,
      tag: filters.tag,
      score: filters.score,
      onlyDuplicates,
      advanced,
      fields: visibleCols as unknown as string[],
    }),
    [
      page,
      rowsPerPage,
      sortBy,
      sortDir,
      debouncedSearch,
      filters.stato,
      filters.sede,
      filters.commerciale,
      filters.origine,
      filters.tag,
      filters.score,
      onlyDuplicates,
      advanced,
      visibleCols,
    ],
  )

  const { data, isFetching, isError } = useLeadsQuery(params, {
    sp: initialSp,
    data: initialLeads,
  })
  const { data: stats } = useLeadStats(initialStats)

  const createLead = useCreateLead()
  const deleteLead = useDeleteLead()
  const updateLead = useUpdateLead()
  const bulk = useBulkLeads()

  // Le righe sono proiezioni selettive; la tabella usa solo i campi inclusi.
  const pageRows = useMemo(
    () => (data?.rows ?? []) as Lead[],
    [data?.rows],
  )
  const total = data?.total ?? 0
  const headerTotal = stats?.total ?? 0

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const start = (page - 1) * rowsPerPage
  const rangeStart = total === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, total)

  // --- Altezza dinamica della pagina (footer sempre visibile) ---
  // La topbar ha altezza variabile (responsive/breakpoint), quindi un calc fisso
  // non basta. Misuriamo l'offset reale del contenitore dalla cima del viewport e
  // blocchiamo l'altezza fino al fondo schermo: il footer resta sempre in vista e
  // la tabella scrolla internamente, su qualsiasi dimensione di schermo.
  const rootRef = useRef<HTMLDivElement>(null)
  const [availH, setAvailH] = useState<number | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Padding inferiore del <main> (py-6 = 24px), costante a ogni breakpoint.
    const BOTTOM_GAP = 24
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY
      const next = Math.max(360, window.innerHeight - top - BOTTOM_GAP)
      setAvailH(next)
    }
    measure()
    window.addEventListener("resize", measure)
    // La topbar può cambiare altezza (stacking responsive): osserva il body.
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    return () => {
      window.removeEventListener("resize", measure)
      ro.disconnect()
    }
  }, [])

  const handleFilterChange = useCallback((next: LeadFilterState) => {
    setFilters(next)
    setPage(1)
  }, [])

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
    setAdvanced(EMPTY_ADVANCED)
    setOnlyDuplicates(false)
    setPage(1)
  }, [])

  const handleAdvancedApply = useCallback((next: AdvancedFilterState) => {
    setAdvanced(next)
    setPage(1)
  }, [])

  // Crea un nuovo lead via API e torna alla prima pagina
  const handleCreateLead = (lead: Lead) => {
    createLead.mutate(lead, {
      onSuccess: () =>
        toast.success("Lead creato", {
          description: `${lead["Nome Lead"]} aggiunto al CRM.`,
        }),
      onError: () => toast.error("Creazione non riuscita"),
    })
    setFilters(DEFAULT_FILTERS)
    setAdvanced(EMPTY_ADVANCED)
    setOnlyDuplicates(false)
    setSortBy(null)
    setPage(1)
  }

  // Controllo duplicati: usa il conteggio aggregato dalle statistiche
  const handleCheckDuplicates = () => {
    const found = stats?.duplicati ?? 0
    if (found === 0) {
      toast.success("Nessun duplicato trovato", {
        description: "Tutti i lead risultano univoci per email e telefono.",
      })
      return
    }
    setOnlyDuplicates(true)
    setPage(1)
    toast.warning(`${found} possibili duplicati`, {
      description: "Filtro applicato: verifica e unisci i record sospetti.",
    })
  }

  const handleSort = useCallback((col: LeadColumnId) => {
    setSortBy((prevCol) => {
      if (prevCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prevCol
      }
      setSortDir("asc")
      return col
    })
    setPage(1)
  }, [])

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allOnPage = pageRows.every((l) => prev.has(l.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((l) => next.delete(l.id))
      else pageRows.forEach((l) => next.add(l.id))
      return next
    })
  }, [pageRows])

  // Righe selezionate disponibili nella pagina corrente (per la toolbar)
  const selectedRows = useMemo(
    () => pageRows.filter((l) => selected.has(l.id)),
    [pageRows, selected],
  )
  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const handleBulkOwner = (owner: string) => {
    const n = selected.size
    bulk.mutate({ action: "transfer", ids: selectedIds, value: owner })
    toast.success("Proprietario aggiornato", {
      description: `${n} lead assegnati a ${owner}.`,
    })
    setSelected(new Set())
  }

  const handleBulkStato = (stato: string) => {
    const n = selected.size
    bulk.mutate({
      action: "update",
      ids: selectedIds,
      field: "Stato Lead",
      value: stato,
    })
    toast.success("Stato aggiornato", {
      description: `${n} lead impostati su "${stato}".`,
    })
    setSelected(new Set())
  }

  // Aggiornamento di massa generico su Stato Lead / Sede / Tag
  const handleBulkUpdate = (
    field: "Stato Lead" | "Sede" | "Tag",
    value: string,
  ) => {
    const n = selected.size
    bulk.mutate({ action: "update", ids: selectedIds, field, value })
    toast.success("Lead aggiornati", {
      description: `${field} impostato su "${value}" per ${n} lead.`,
    })
    setSelected(new Set())
  }

  const handleBulkConvert = () => {
    const n = selected.size
    bulk.mutate({ action: "convert", ids: selectedIds })
    toast.success("Lead convertiti", {
      description: `${n} lead convertiti in clienti.`,
    })
    setSelected(new Set())
  }

  const handleBulkApprove = () => {
    const n = selected.size
    toast.success("Lead approvati", { description: `${n} lead approvati.` })
    setSelected(new Set())
  }

  const handleBulkDedup = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) {
      toast.info("Nessun record rimosso")
      setSelected(new Set())
      return
    }
    bulk.mutate({ action: "delete", ids: idsToRemove })
    toast.success("Duplicati uniti", {
      description: `${idsToRemove.length} record duplicati rimossi.`,
    })
    setSelected(new Set())
  }

  const handleBulkExport = async () => {
    try {
      const all = await fetchLeadsForExport(params)
      const sel = new Set(selectedIds)
      const rows = all.filter((r) => sel.has(r.id))
      downloadLeadsCsv(rows, `lead-selezione-${rows.length}.csv`)
      toast.success("Esportazione avviata", {
        description: `${rows.length} lead esportati in CSV.`,
      })
    } catch {
      toast.error("Esportazione non riuscita")
    }
  }

  const handleExportFiltered = async () => {
    try {
      const rows = await fetchLeadsForExport(params)
      downloadLeadsCsv(rows, `lead-filtrati-${rows.length}.csv`)
      toast.success("Esportazione avviata", {
        description: `${rows.length} lead filtrati esportati.`,
      })
    } catch {
      toast.error("Esportazione non riuscita")
    }
  }

  const confirmBulkDelete = () => {
    const n = selected.size
    bulk.mutate({ action: "delete", ids: selectedIds })
    toast.success("Lead eliminati", { description: `${n} lead rimossi.` })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const name = deleteTarget["Nome Lead"]
    deleteLead.mutate(deleteTarget.id, {
      onSuccess: () =>
        toast.success("Lead eliminato", { description: `${name} rimosso.` }),
      onError: () => toast.error("Eliminazione non riuscita"),
    })
    setDeleteTarget(null)
  }

  const confirmConvert = () => {
    if (!convertTarget) return
    const name = convertTarget["Nome Lead"]
    updateLead.mutate(
      { id: convertTarget.id, patch: { "Stato Lead": "Convertito" } },
      {
        onSuccess: () =>
          toast.success("Lead convertito", {
            description: `${name} convertito in cliente.`,
          }),
        onError: () => toast.error("Conversione non riuscita"),
      },
    )
    setConvertTarget(null)
  }

  // Apre lo sheet impostazioni su una specifica sezione (es. da menu Azioni)
  const openSettings = (section: SettingsSectionId) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  return (
    <div
      ref={rootRef}
      style={availH ? { height: availH } : undefined}
      className="flex h-[calc(100svh-9rem)] flex-col gap-4 lg:h-[calc(100svh-6rem)]"
    >
      {/* Header pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Lead
          </h1>
          <p className="mt-1 flex items-center gap-2 text-[15px] text-muted-foreground">
            {headerTotal.toLocaleString("it-IT")} lead disponibili
            {isFetching ? (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Aggiornamento in corso"
              />
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Impostazioni lead (generali, vista colonne) */}
          <LeadSettingsSheet
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={settingsSection}
            onSectionChange={setSettingsSection}
            visibleCols={visibleCols}
            onVisibleColsChange={setVisibleCols}
            density={density}
            onDensityChange={setDensity}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n)
              setPage(1)
            }}
            trigger={
              <Button
                variant="outline"
                size="icon"
                aria-label="Impostazioni lead"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
              </Button>
            }
          />

          {/* Menu azioni (cambia in base alla selezione) */}
          <LeadActionsMenu
            selectedCount={selected.size}
            filtered={pageRows}
            selectedRows={selectedRows}
            tags={allTags}
            onOpenSettings={openSettings}
            onCheckDuplicates={handleCheckDuplicates}
            onImport={() => setImportOpen(true)}
            onExportFiltered={handleExportFiltered}
            onExportSelection={handleBulkExport}
            onBulkTransfer={handleBulkOwner}
            onBulkUpdate={handleBulkUpdate}
            onBulkConvert={handleBulkConvert}
            onBulkApprove={handleBulkApprove}
            onBulkDedup={handleBulkDedup}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <Button
            variant="outline"
            className="bg-card"
            onClick={() => setImportOpen(true)}
          >
            <Upload data-icon="inline-start" />
            Importa
          </Button>

          <Button
            variant="outline"
            className="bg-card"
            onClick={handleExportFiltered}
          >
            <Download data-icon="inline-start" />
            Esporta
          </Button>

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewLeadOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuovo lead
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { label: "Tutti", stato: "all", commerciale: "all" },
          { label: "Da contattare", stato: "Non contattato", commerciale: "all" },
          { label: "Da richiamare", stato: "Tentato di contattare", commerciale: "all" },
          { label: "Non assegnati", stato: "all", commerciale: "__unassigned__" },
        ].map((view) => {
          const active =
            filters.stato === view.stato && filters.commerciale === view.commerciale
          return (
            <motion.button
              type="button"
              key={view.label}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                handleFilterChange({
                  ...DEFAULT_FILTERS,
                  stato: view.stato,
                  commerciale: view.commerciale,
                })
              }
              className={
                active
                  ? "h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm"
                  : "h-10 shrink-0 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {view.label}
            </motion.button>
          )
        })}
      </div>

      {/* Indicatore filtro duplicati attivo */}
      {onlyDuplicates ? (
        <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
          <span className="text-sm font-medium text-secondary-foreground">
            Filtro attivo: solo possibili duplicati
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOnlyDuplicates(false)}
          >
            <X data-icon="inline-start" />
            Rimuovi
          </Button>
        </div>
      ) : null}

      {/* Barra filtri + pannello filtri avanzati */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
        <AdvancedFilters
          applied={advanced}
          onApply={handleAdvancedApply}
          tags={allTags}
        />
        <div className="min-w-0 flex-1">
          <LeadFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            tags={allTags}
          />
        </div>
      </div>

      {/* Stato errore */}
      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Errore nel caricamento dei lead. Riprova.
        </div>
      ) : null}

      {/* Tabella — occupa lo spazio rimanente e scrolla internamente */}
      <div className="min-h-0 flex-1">
        <LeadTable
          leads={pageRows}
          columns={columns}
          columnWidths={columnWidths}
          onColumnWidthChange={(column, width) =>
            setColumnWidths((current) => ({ ...current, [column]: width }))
          }
          onColumnReorder={reorderColumns}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onConvert={(lead) => setConvertTarget(lead)}
          onDelete={(lead) => setDeleteTarget(lead)}
          onUpdate={(lead, patch) =>
            updateLead.mutate(
              { id: lead.id, patch },
              {
                onSuccess: () => toast.success("Lead aggiornato"),
                onError: () => toast.error("Aggiornamento non riuscito"),
              },
            )
          }
          onDuplicate={(lead) => {
            const copy = {
              ...lead,
              id: crypto.randomUUID(),
              "Nome Lead": `Copia di ${lead["Nome Lead"]}`,
              "Badge dell'attività": false,
              "Badge di nota": false,
              attivita: [],
              documenti: [],
            }
            createLead.mutate(copy, {
              onSuccess: () => toast.success("Lead duplicato"),
              onError: () => toast.error("Duplicazione non riuscita"),
            })
          }}
          onRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: leadsKeys.lists() })
            void queryClient.invalidateQueries({ queryKey: leadsKeys.stats() })
          }}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          density={density}
        />
      </div>

      {/* Footer paginazione — sempre visibile e in primo piano */}
      <div className="sticky bottom-0 z-30 -mx-5 flex shrink-0 flex-col gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {rangeStart}-{rangeEnd} di {total.toLocaleString("it-IT")}
            {selected.size > 0 ? ` · ${selected.size} selezionati` : ""}
          </span>
          <select
            aria-label="Numero di righe per pagina"
            value={String(rowsPerPage)}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(1)
            }}
            className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {Object.entries(ROWS_ITEMS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Successivo
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
        </div>
      </div>

      {/* Toolbar azioni bulk */}
      <BulkToolbar
        count={selected.size}
        onChangeOwner={handleBulkOwner}
        onChangeStato={handleBulkStato}
        onExport={handleBulkExport}
        onDelete={() => setBulkDeleteOpen(true)}
        onClear={() => setSelected(new Set())}
      />

      {/* Dialog elimina bulk */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead selezionati</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {selected.size} lead
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Elimina {selected.size} lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog elimina */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.["Nome Lead"] ?? ""}
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog converti */}
      <Dialog
        open={convertTarget !== null}
        onOpenChange={(open) => !open && setConvertTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti a cliente</DialogTitle>
            <DialogDescription>
              Vuoi convertire{" "}
              <span className="font-semibold text-foreground">
                {convertTarget?.["Nome Lead"] ?? ""}
              </span>{" "}
              in cliente? Verrà creata una nuova scheda cliente con i dati del
              lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={confirmConvert}
            >
              Converti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewLeadDialog
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        onCreate={handleCreateLead}
      />

      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
