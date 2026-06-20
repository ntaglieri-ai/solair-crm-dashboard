"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockClienti,
  CLIENTI_TOTAL,
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

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

// Simula il download di un file CSV a partire dai clienti passati
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

// Estrae l'elenco tag unico dal dataset clienti
const ALL_TAGS = Array.from(
  new Set(mockClienti.flatMap((c) => c.Tag)),
).sort((a, b) => a.localeCompare(b))

export default function ClientiPage() {
  const [clienti, setClienti] = useState<ClienteRecord[]>(mockClienti)
  const [filters, setFilters] = useState<ClienteFilterState>(
    DEFAULT_CLIENTE_FILTERS,
  )
  const [newClienteOpen, setNewClienteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<ClienteRecord | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState<ClienteColumnId[]>(
    DEFAULT_CLIENTE_COLUMNS,
  )
  const [sortBy, setSortBy] = useState<ClienteColumnId | null>("Ora modifica")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [density, setDensity] = useState<Density>("normale")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<ClienteSettingsSectionId>("generali")

  // Le colonne visibili sono renderizzate nell'ordine di `visibleCols`.
  const columns = useMemo(
    () =>
      visibleCols
        .map((id) => CLIENTE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [visibleCols],
  )

  // Set di id che condividono email/cellulare con un altro cliente
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, string[]>()
    for (const c of clienti) {
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
  }, [clienti])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = clienti.filter((c) => {
      if (onlyDuplicates && !duplicateIds.has(c.id)) return false
      if (q) {
        const haystack = [c["Nome Clienti"], c["E-mail"], c.Cellulare ?? ""]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.stato !== "all" && c.Stato !== filters.stato) return false
      if (filters.sede !== "all" && c.Sede !== filters.sede) return false
      if (
        filters.proprietario !== "all" &&
        c["Clienti Proprietario"] !== filters.proprietario
      )
        return false
      if (
        filters.installatore !== "all" &&
        c.Installatore !== filters.installatore
      )
        return false
      return true
    })

    if (sortBy) {
      rows.sort((a, b) => {
        const av = a[sortBy]
        const bv = b[sortBy]
        let cmp = 0
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv
        } else {
          cmp = String(av ?? "").localeCompare(String(bv ?? ""), "it")
        }
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return rows
  }, [filters, sortBy, sortDir, clienti, onlyDuplicates, duplicateIds])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const rangeStart = filtered.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, filtered.length)

  const selectedRows = useMemo(
    () => filtered.filter((c) => selected.has(c.id)),
    [filtered, selected],
  )

  const handleFilterChange = (next: ClienteFilterState) => {
    setFilters(next)
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_CLIENTE_FILTERS)
    setOnlyDuplicates(false)
    setPage(1)
  }

  const handleCreate = (cliente: ClienteRecord) => {
    setClienti((prev) => [cliente, ...prev])
    setFilters(DEFAULT_CLIENTE_FILTERS)
    setOnlyDuplicates(false)
    setSortBy(null)
    setPage(1)
  }

  // Controllo duplicati manuale (avviato da menu): scansiona email/cellulare
  const handleCheckDuplicates = () => {
    if (duplicateIds.size === 0) {
      toast.success("Nessun duplicato trovato", {
        description: "Tutti i clienti risultano univoci per email e cellulare.",
      })
      return
    }
    setOnlyDuplicates(true)
    setPage(1)
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
      const allOnPage = pageRows.every((c) => prev.has(c.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((c) => next.delete(c.id))
      else pageRows.forEach((c) => next.add(c.id))
      return next
    })
  }

  const handleBulkOwner = (owner: string) => {
    const n = selected.size
    setClienti((prev) =>
      prev.map((c) =>
        selected.has(c.id) ? { ...c, "Clienti Proprietario": owner } : c,
      ),
    )
    toast.success("Proprietario aggiornato", {
      description: `${n} clienti assegnati a ${owner}.`,
    })
    setSelected(new Set())
  }

  // Aggiornamento di massa generico su Stato / Sede / Tag
  const handleBulkUpdate = (field: "Stato" | "Sede" | "Tag", value: string) => {
    const n = selected.size
    setClienti((prev) =>
      prev.map((c) => {
        if (!selected.has(c.id)) return c
        if (field === "Tag") {
          const next = c.Tag.includes(value) ? c.Tag : [...c.Tag, value]
          return { ...c, Tag: next }
        }
        return { ...c, [field]: value } as ClienteRecord
      }),
    )
    toast.success("Clienti aggiornati", {
      description: `${field} impostato su "${value}" per ${n} clienti.`,
    })
    setSelected(new Set())
  }

  const handleBulkDedup = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) {
      toast.info("Nessun record rimosso")
      setSelected(new Set())
      return
    }
    const remove = new Set(idsToRemove)
    setClienti((prev) => prev.filter((c) => !remove.has(c.id)))
    toast.success("Duplicati uniti", {
      description: `${idsToRemove.length} record duplicati rimossi.`,
    })
    setSelected(new Set())
  }

  const handleBulkExport = () => {
    downloadClientiCsv(
      selectedRows,
      `clienti-selezione-${selectedRows.length}.csv`,
    )
    toast.success("Esportazione avviata", {
      description: `${selectedRows.length} clienti esportati in CSV.`,
    })
  }

  const handleExportFiltered = () => {
    downloadClientiCsv(filtered, `clienti-filtrati-${filtered.length}.csv`)
    toast.success("Esportazione avviata", {
      description: `${filtered.length} clienti filtrati esportati.`,
    })
  }

  const confirmBulkDelete = () => {
    const n = selected.size
    setClienti((prev) => prev.filter((c) => !selected.has(c.id)))
    toast.success("Clienti eliminati", { description: `${n} clienti rimossi.` })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setClienti((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    toast.success("Cliente eliminato", {
      description: `${deleteTarget["Nome Clienti"]} è stato rimosso.`,
    })
    setDeleteTarget(null)
  }

  // Apre lo sheet impostazioni su una specifica sezione (es. da menu Azioni)
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
            {CLIENTI_TOTAL.toLocaleString("it-IT")} clienti totali nel CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Impostazioni clienti (generali, colonne, tag, regole) */}
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

          {/* Menu azioni (cambia in base alla selezione) */}
          <ClienteActionsMenu
            selectedCount={selected.size}
            filtered={filtered}
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

      {/* Barra filtri */}
      <ClienteFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Tabella */}
      <ClienteTable
        clienti={pageRows}
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

      {/* Footer paginazione */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {rangeStart}-{rangeEnd} di {filtered.length}
            {selected.size > 0 ? ` · ${selected.size} selezionati` : ""}
          </span>
          <Select
            items={ROWS_ITEMS}
            value={String(rowsPerPage)}
            onValueChange={(v) => {
              setRowsPerPage(Number(v))
              setPage(1)
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
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft data-icon="inline-start" />
            Precedente
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="bg-card"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Successivo
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </div>

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
            <Button variant="destructive" onClick={confirmBulkDelete}>
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
            <Button variant="destructive" onClick={confirmDelete}>
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
