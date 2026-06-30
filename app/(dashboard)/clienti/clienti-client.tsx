"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
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
import {
  CLIENTE_COLUMNS,
  DEFAULT_CLIENTE_COLUMNS,
  type ClienteRecord,
  type ClienteColumnId,
} from "@/lib/mock-data"
import {
  ClienteFilters,
  DEFAULT_CLIENTE_FILTERS,
  type ClienteFilterState,
} from "@/components/clienti/cliente-filters"
import {
  ClienteTable,
  type SortDir,
  type Density,
} from "@/components/clienti/cliente-table"
import {
  ClienteSettingsSheet,
  type ClienteSettingsSectionId,
} from "@/components/clienti/cliente-settings-sheet"
import { ClienteActionsMenu } from "@/components/clienti/cliente-actions-menu"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import { NewClienteDialog } from "@/components/clienti/new-cliente-dialog"
import {
  type ClientiListParams,
  type ClientiListResponse,
  INITIAL_PAGE_SIZE,
} from "@/lib/clienti/api-types"
import {
  clientiKeys,
  useClientiQuery,
  useCreateCliente,
  useDeleteCliente,
  useDeleteClienti,
  bulkUpdateClienti,
  fetchClientiForExport,
} from "@/lib/clienti/hooks"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
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
}

export function ClientiClient({ initialSp, initialData }: ClientiClientProps) {
  const qc = useQueryClient()

  // --- Filter / sort / pagination state ---
  const [filters, setFilters] = useState<ClienteFilterState>(DEFAULT_CLIENTE_FILTERS)
  const [sortBy, setSortBy] = useState<ClienteColumnId | null>("Ora modifica")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(INITIAL_PAGE_SIZE)

  // --- UI state ---
  const [newClienteOpen, setNewClienteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<ClienteRecord | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState<ClienteColumnId[]>(DEFAULT_CLIENTE_COLUMNS)
  const [density, setDensity] = useState<Density>("normale")
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
    }),
    [page, rowsPerPage, sortBy, sortDir, filters],
  )

  const { data, isFetching } = useClientiQuery(params, {
    sp: initialSp,
    data: initialData,
  })

  const pageRows = data?.rows ?? initialData.rows
  const total = data?.total ?? initialData.total
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(page * rowsPerPage, total)

  // --- Mutations ---
  const createCliente = useCreateCliente()
  const deleteSingle = useDeleteCliente()
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

  const handleCreate = (cliente: ClienteRecord) => {
    createCliente.mutate(cliente, {
      onSuccess: () => {
        toast.success("Cliente creato", {
          description: `${cliente["Nome Clienti"]} è stato aggiunto.`,
        })
        setNewClienteOpen(false)
        setPage(1)
      },
      onError: () => toast.error("Errore nella creazione del cliente"),
    })
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

  const handleBulkExport = () => {
    downloadClientiCsv(selectedRows, `clienti-selezione-${selectedRows.length}.csv`)
    toast.success("Esportazione avviata", {
      description: `${selectedRows.length} clienti esportati in CSV.`,
    })
  }

  const handleExportFiltered = async () => {
    try {
      const rows = await fetchClientiForExport(params)
      downloadClientiCsv(rows, `clienti-filtrati-${rows.length}.csv`)
      toast.success("Esportazione avviata", {
        description: `${rows.length} clienti filtrati esportati.`,
      })
    } catch {
      toast.error("Errore nell'esportazione")
    }
  }

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
    <div className="flex flex-col gap-5">
      {/* Header pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Clienti
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("it-IT")} clienti totali nel CRM
            {isFetching && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                Aggiornamento…
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                size="icon"
                aria-label="Impostazioni clienti"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
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
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewClienteOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuovo cliente
          </Button>
        </div>
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

      {/* Barra filtri */}
      <ClienteFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

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
        <ClienteTable
          clienti={visibleRows}
          columns={columns}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onDelete={(cliente) => setDeleteTarget(cliente)}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          density={density}
        />
      )}

      {/* Footer paginazione */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {rangeStart}–{rangeEnd} di {total.toLocaleString("it-IT")}
              {selected.size > 0 ? ` · ${selected.size} selezionati` : ""}
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
      )}

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
