"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react"
import { IconSettings } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { usePermissions } from "@/lib/permissions/provider"
import { useColumnPreferences } from "@/lib/shared/use-column-preferences"
import { useClienteTags } from "@/lib/cliente-tag-store"
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
import {
  CLIENTE_COLUMNS,
  DEFAULT_CLIENTE_COLUMNS,
  type ClienteRecord,
  type ClienteColumnId,
} from "@/lib/mock-data"
import { chiaveCampoCliente } from "@/lib/permissions/field-map"
import {
  ClienteSearchInput,
  DEFAULT_CLIENTE_FILTERS,
  type ClienteFilterState,
} from "@/components/clienti/cliente-filters"
import { ClienteFiltersDrawer } from "@/components/clienti/cliente-filters-drawer"
import {
  ClienteTable,
  type SortDir,
} from "@/components/clienti/cliente-table"
import {
  ClienteSettingsSheet,
  type ClienteSettingsSectionId,
} from "@/components/clienti/cliente-settings-sheet"
import { ClienteActionsMenu } from "@/components/clienti/cliente-actions-menu"
import { BulkEmailDialog } from "@/components/shared/bulk-email-dialog"
import { BulkEmailBarButton } from "@/components/shared/bulk-email-triggers"
import { BulkSelectionBar } from "@/components/shared/bulk-selection-bar"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import { NewClienteDialog } from "@/components/clienti/new-cliente-dialog"
import {
  ExportTruncatoDialog,
  type ExportTruncatoInfo,
} from "@/components/shared/export-truncato-dialog"
import {
  type ClientiListParams,
  type ClientiListResponse,
  INITIAL_PAGE_SIZE,
} from "@/lib/clienti/api-types"
import {
  CLIENTI_VIEW_COOKIE,
  CLIENTI_VIEW_COOKIE_PATH,
  serializeClienteViewPreferences,
  type ClienteViewPreferences,
} from "@/lib/clienti/view-preferences"
import {
  clientiKeys,
  useClientiQuery,
  useCreateCliente,
  useDeleteCliente,
  useUpdateCliente,
  useDeleteClienti,
  bulkUpdateClienti,
  fetchClientiForExport,
  fetchClientiByIdsForExport,
  type ClientiExportResult,
} from "@/lib/clienti/hooks"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "20": "20 righe",
  "30": "30 righe",
  "50": "50 righe",
}

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

function downloadClientiCsv(rows: ClienteRecord[], filename: string) {
  const cols = CLIENTE_COLUMNS.map((c) => c.id)
  const header = cols.join(";")
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c]
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

interface ClientiClientProps {
  initialSp: string
  initialData: ClientiListResponse
  initialPreferences: Omit<ClienteViewPreferences, "version" | "owner"> | null
}

export function ClientiClient({
  initialSp,
  initialData,
  initialPreferences,
}: ClientiClientProps) {
  const qc = useQueryClient()

  // --- Filter / sort / pagination state ---
  const [filters, setFilters] = useState<ClienteFilterState>(DEFAULT_CLIENTE_FILTERS)
  const [sortBy, setSortBy] = useState<ClienteColumnId | null>("Ora modifica")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
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
  // Blocca lo scroll della pagina su mobile: stesso fix già applicato a Lead,
  // resta scrollabile solo la lista clienti. Nessun effetto su desktop.
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
  const mobileAvailH = isMobile ? availH : null
  useEffect(() => {
    if (!isMobile) return
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
  const [newClienteOpen, setNewClienteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Export troncato: l'avviso e il download che parte solo dopo conferma.
  const [exportTruncato, setExportTruncato] = useState<ExportTruncatoInfo | null>(null)
  const pendingExport = useRef<(() => void) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClienteRecord | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false)
  const permissions = usePermissions()
  const preferenceOwner =
    permissions.snapshot.subject.userId ??
    permissions.snapshot.subject.authUserId ??
    "anonymous"
  const {
    visibleCols: visibleColsGrezze,
    setVisibleCols,
    columnWidths,
    setColumnWidths,
    density,
    setDensity,
    reorderColumns,
    preferencesLoaded,
  } = useColumnPreferences<ClienteColumnId>({
    storageKey: `solair:clienti:view:${preferenceOwner}:v2`,
    validIds: new Set(CLIENTE_COLUMNS.map((c) => c.id)),
    defaultVisibleCols: DEFAULT_CLIENTE_COLUMNS,
    initialPreferences,
  })

  // Le preferenze di colonna vivono in localStorage e sopravvivono a un cambio
  // di ruolo: una colonna sensibile gia' attivata resterebbe visibile per
  // sempre. Il filtro si applica qui, dopo la lettura delle preferenze e prima
  // di ogni uso, cosi' vale sia per la tabella sia per il selettore colonne.
  const visibleCols = useMemo(
    () =>
      visibleColsGrezze.filter((id) => {
        const campo = chiaveCampoCliente(id)
        return campo === null || permissions.canField("clienti", campo, "view")
      }),
    [visibleColsGrezze, permissions],
  )

  useEffect(() => {
    if (!preferencesLoaded) return
    const preferences: ClienteViewPreferences = {
      version: 2,
      owner: preferenceOwner,
      visibleCols,
      columnWidths,
      density,
    }
    const secure = window.location.protocol === "https:" ? "; Secure" : ""
    document.cookie =
      `${CLIENTI_VIEW_COOKIE}=${serializeClienteViewPreferences(preferences)}` +
      `; Path=${CLIENTI_VIEW_COOKIE_PATH}; Max-Age=31536000; SameSite=Lax${secure}`
  }, [
    columnWidths,
    density,
    preferenceOwner,
    preferencesLoaded,
    visibleCols,
  ])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<ClienteSettingsSectionId>("generali")

  // --- Build server-side query params ---
  const params = useMemo<ClientiListParams>(
    () => ({
      page,
      pageSize: rowsPerPage,
      sortBy: sortBy ?? null,
      sortDir,
      search: filters.search,
      stato: filters.stato,
      sede: filters.sede,
      proprietario: filters.proprietario,
      installatore: filters.installatore,
      tag: filters.tag,
    }),
    [page, rowsPerPage, sortBy, sortDir, filters],
  )

  const { data, isFetching } = useClientiQuery(params, {
    sp: initialSp,
    data: initialData,
  })

  const pageRows = data?.rows ?? initialData.rows
  const { hydrateClienteTagIds } = useClienteTags()
  useEffect(() => {
    const assignments = Object.fromEntries(
      pageRows.map((cliente) => [cliente.id, cliente.tagIds ?? []]),
    )
    hydrateClienteTagIds(assignments)
  }, [hydrateClienteTagIds, pageRows])
  const total = data?.total ?? initialData.total
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, total)

  // --- Mutations ---
  const createCliente = useCreateCliente()
  const deleteSingle = useDeleteCliente()
  const updateCliente = useUpdateCliente()
  const deleteBulk = useDeleteClienti()

  // --- Derived ---
  const columns = useMemo(
    () =>
      visibleCols
        .map((id) => CLIENTE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [visibleCols],
  )

  // Duplicati rilevati sulla pagina corrente (email/cellulare condivisi).
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, string[]>()
    for (const c of pageRows) {
      for (const k of [norm(c["E-mail"]), norm(c.Cellulare)].filter(Boolean)) {
        const arr = byKey.get(k) ?? []
        arr.push(c.id)
        byKey.set(k, arr)
      }
    }
    const ids = new Set<string>()
    for (const arr of byKey.values()) {
      if (arr.length > 1) arr.forEach((id) => ids.add(id))
    }
    return ids
  }, [pageRows])

  // Righe filtrate per il filtro "solo duplicati" (client-side sulla pagina corrente).
  const visibleRows = useMemo(
    () =>
      onlyDuplicates ? pageRows.filter((c) => duplicateIds.has(c.id)) : pageRows,
    [pageRows, onlyDuplicates, duplicateIds],
  )

  const selectedRows = useMemo(
    () => visibleRows.filter((c) => selected.has(c.id)),
    [visibleRows, selected],
  )

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const ALL_TAGS = useMemo(
    () => Array.from(new Set(pageRows.flatMap((c) => c.Tag))).sort(),
    [pageRows],
  )

  // --- Handlers ---
  const handleFilterChange = (next: ClienteFilterState) => {
    setFilters(next)
    setPage(1)
    setSelected(new Set())
  }

  const handleReset = () => {
    setFilters(DEFAULT_CLIENTE_FILTERS)
    setOnlyDuplicates(false)
    setPage(1)
    setSelected(new Set())
  }

  const handleCreate = async (cliente: ClienteRecord) => {
    await createCliente.mutateAsync(cliente)
    setPage(1)
  }

  const handleCheckDuplicates = () => {
    if (duplicateIds.size === 0) {
      toast.success("Nessun duplicato trovato", {
        description: "Tutti i clienti in questa pagina risultano univoci.",
      })
      return
    }
    setOnlyDuplicates(true)
    toast.warning(`${duplicateIds.size} possibili duplicati`, {
      description: "Filtro applicato: verifica e unisci i record sospetti.",
    })
  }

  const handleSort = (col: ClienteColumnId) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
    setPage(1)
    setSelected(new Set())
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) => {
      const allOnPage = visibleRows.every((c) => prev.has(c.id))
      const next = new Set(prev)
      if (allOnPage) visibleRows.forEach((c) => next.delete(c.id))
      else visibleRows.forEach((c) => next.add(c.id))
      return next
    })
  }

  const handleBulkOwner = async (owner: string) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateClienti(ids, { "Clienti Proprietario": owner })
      qc.invalidateQueries({ queryKey: clientiKeys.lists() })
      toast.success("Proprietario aggiornato", {
        description: `${n} clienti assegnati a ${owner}.`,
      })
      setSelected(new Set())
    } catch {
      toast.error("Errore nell'aggiornamento del proprietario")
    }
  }

  const handleBulkUpdate = async (
    field: "Stato" | "Sede" | "Tag",
    value: string,
  ) => {
    const ids = Array.from(selected)
    const n = ids.length
    try {
      await bulkUpdateClienti(ids, { [field]: value } as Partial<ClienteRecord>)
      qc.invalidateQueries({ queryKey: clientiKeys.lists() })
      toast.success("Clienti aggiornati", {
        description: `${field} impostato su "${value}" per ${n} clienti.`,
      })
      setSelected(new Set())
    } catch {
      toast.error("Errore nell'aggiornamento")
    }
  }

  const handleBulkDedup = async (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) {
      toast.info("Nessun record rimosso")
      setSelected(new Set())
      return
    }
    deleteBulk.mutate(idsToRemove, {
      onSuccess: () => {
        toast.success("Duplicati uniti", {
          description: `${idsToRemove.length} record duplicati rimossi.`,
        })
        setSelected(new Set())
      },
      onError: () => toast.error("Errore nella rimozione dei duplicati"),
    })
  }

  // Anche l'export della selezione passa ora dal server: prima costruiva il CSV
  // dalle righe gia' in pagina, quindi non lasciava alcuna traccia nell'audit
  // log di un'estrazione di dati personali. Il tetto e' molto piu' alto di
  // prima, ma quando c'e' un troncamento va detto prima del download.
  const runExport = async (
    fetcher: () => Promise<ClientiExportResult>,
    filename: (n: number) => string,
  ) => {
    try {
      const result = await fetcher()
      const download = () => {
        downloadClientiCsv(result.rows, filename(result.rows.length))
        toast.success("Esportazione avviata", {
          description: `${result.rows.length} clienti esportati in CSV.`,
        })
      }
      if (result.truncated) {
        setExportTruncato({
          esportate: result.rows.length,
          totali: result.total,
          limite: result.limit,
          entita: "clienti",
        })
        pendingExport.current = download
        return
      }
      download()
    } catch (error) {
      // Il messaggio del server arriva fin qui: un 403 per permesso mancante
      // dice all'utente cosa chiedere all'amministratore, un generico
      // "errore" lo lascerebbe a indovinare.
      toast.error(
        error instanceof Error ? error.message : "Errore nell'esportazione",
      )
    }
  }

  const handleBulkExport = () =>
    runExport(
      () => fetchClientiByIdsForExport(selectedIds),
      (n) => `clienti-selezione-${n}.csv`,
    )

  const handleExportFiltered = () =>
    runExport(
      () => fetchClientiForExport(params),
      (n) => `clienti-filtrati-${n}.csv`,
    )

  const confirmBulkDelete = () => {
    const ids = Array.from(selected)
    const n = ids.length
    deleteBulk.mutate(ids, {
      onSuccess: () => {
        toast.success("Clienti eliminati", { description: `${n} clienti rimossi.` })
        setBulkDeleteOpen(false)
        setSelected(new Set())
      },
      onError: () => toast.error("Errore nell'eliminazione"),
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const nome = deleteTarget["Nome Clienti"]
    deleteSingle.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Cliente eliminato", { description: `${nome} è stato rimosso.` })
        setDeleteTarget(null)
      },
      onError: () => toast.error("Errore nell'eliminazione"),
    })
  }

  const openSettings = (section: ClienteSettingsSectionId) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-col gap-2.5 lg:h-auto lg:gap-5 lg:overflow-visible"
      style={mobileAvailH ? { height: mobileAvailH, overflow: "hidden" } : undefined}
    >
      {/* Header pagina */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 lg:gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <h1 className="break-words text-2xl font-bold tracking-tight text-foreground">
            Clienti
          </h1>
          <p className="break-words text-sm text-muted-foreground">
            {total.toLocaleString("it-IT")} clienti totali nel CRM
            {isFetching && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                Aggiornamento…
              </span>
            )}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 lg:flex lg:w-auto lg:flex-wrap lg:justify-end lg:gap-2">
          <ClienteSettingsSheet
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
                aria-label="Impostazioni clienti"
                className="h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-10 lg:p-0 lg:text-sm"
              >
                <IconSettings size={22} stroke={1.8} className="lg:size-[18px]" />
                <span className="lg:hidden">Imposta</span>
              </Button>
            }
          />

          <ClienteActionsMenu
            selectedCount={selected.size}
            filtered={visibleRows}
            selectedRows={selectedRows}
            tags={ALL_TAGS}
            onOpenSettings={openSettings}
            onCheckDuplicates={handleCheckDuplicates}
            onImport={() => setImportOpen(true)}
            onExportFiltered={handleExportFiltered}
            onExportSelection={handleBulkExport}
            onBulkTransfer={handleBulkOwner}
            onBulkUpdate={handleBulkUpdate}
            onBulkDedup={handleBulkDedup}
            onBulkEmail={() => setBulkEmailOpen(true)}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <ClienteFiltersDrawer
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
            onClick={() => setNewClienteOpen(true)}
          >
            <Plus className="size-[22px] lg:size-4" />
            <span className="lg:hidden">Nuovo</span>
            <span className="hidden lg:inline">Nuovo cliente</span>
          </Button>
        </div>
      </div>

      {/* Barra di ricerca — sempre su una riga; il resto dei filtri vive nel drawer "Filtri" */}
      <div className="flex min-w-0 flex-row items-center gap-2 rounded-lg border border-border bg-card p-1 shadow-sm lg:p-2">
        <ClienteSearchInput
          value={filters.search}
          onChange={(v) => handleFilterChange({ ...filters, search: v })}
        />
      </div>

      {/* Banner filtro duplicati attivo */}
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-visible [-webkit-overflow-scrolling:touch]">
        {/* Empty state */}
        {!isFetching && total === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
            <p className="text-base font-medium text-foreground">
              Nessun cliente trovato
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prova a modificare i filtri o aggiungi il primo cliente.
            </p>
            <Button
              className="mt-4 bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => setNewClienteOpen(true)}
            >
              <Plus data-icon="inline-start" />
              Nuovo cliente
            </Button>
          </div>
        )}

        {/* Tabella */}
        {total > 0 && (
          <div style={{ visibility: preferencesLoaded ? undefined : "hidden" }}>
            <ClienteTable
              clienti={visibleRows}
              columns={columns}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onDelete={(cliente) => setDeleteTarget(cliente)}
              onUpdate={(cliente, patch) =>
                updateCliente.mutate(
                  { id: cliente.id, patch },
                  { onError: () => toast.error("Aggiornamento non riuscito") },
                )
              }
              onRefresh={() => {
                void qc.invalidateQueries({ queryKey: clientiKeys.lists() })
              }}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              density={density}
              columnWidths={columnWidths}
              onOpenSettings={() => openSettings("colonne")}
              onColumnWidthChange={(column, width) =>
                setColumnWidths((current) => ({ ...current, [column]: width }))
              }
              onColumnReorder={reorderColumns}
            />
          </div>
        )}
      </div>

      {/* Footer paginazione — sticky solo su mobile, in flusso normale da lg in su */}
      {total > 0 && (
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
      )}

      {/* Barra azioni di massa (in basso, sulla selezione) */}
      <BulkSelectionBar
        count={selected.size}
        singolare="cliente selezionato"
        plurale="clienti selezionati"
        onClear={() => setSelected(new Set())}
      >
        <BulkEmailBarButton
          selectedCount={selected.size}
          onSelect={() => setBulkEmailOpen(true)}
        />
      </BulkSelectionBar>

      {/* Avviso export incompleto */}
      <ExportTruncatoDialog
        info={exportTruncato}
        onCancel={() => {
          pendingExport.current = null
          setExportTruncato(null)
        }}
        onConfirm={() => {
          pendingExport.current?.()
          pendingExport.current = null
          setExportTruncato(null)
        }}
      />

      {/* Dialog invio email di massa */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onOpenChange={setBulkEmailOpen}
        recordTipo="cliente"
        recordIds={selectedIds}
      />

      {/* Dialog elimina bulk */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina clienti selezionati</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {selected.size} clienti
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
              Elimina {selected.size} clienti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog elimina singolo */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina cliente</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.["Nome Clienti"] ?? ""}
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
              onClick={confirmDelete}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="clienti"
      />

      <NewClienteDialog
        open={newClienteOpen}
        onOpenChange={setNewClienteOpen}
        onCreate={handleCreate}
      />
    </div>
  )
}
