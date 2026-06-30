"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight } from "lucide-react"
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
  mockInstallatoriRecords,
  INSTALLATORI_TOTAL,
  INSTALLATORE_COLUMNS,
  DEFAULT_INSTALLATORE_COLUMNS,
  type InstallatoreRecord,
  type InstallatoreColumnId,
} from "@/lib/mock-data"
import {
  InstallatoreTagProvider,
  useInstallatoreTags,
} from "@/lib/installatore-tag-store"
import {
  InstallatoreFilters,
  DEFAULT_INSTALLATORE_FILTERS,
  type InstallatoreFilterState,
} from "@/components/installatori/installatore-filters"
import {
  InstallatoreTable,
  type SortDir,
  type Density,
} from "@/components/installatori/installatore-table"
import {
  InstallatoreSettingsSheet,
  type InstallatoreSettingsSectionId,
} from "@/components/installatori/installatore-settings-sheet"
import { InstallatoreActionsMenu } from "@/components/installatori/installatore-actions-menu"
import { InstallatoreCreateButton } from "@/components/installatori/installatore-create-button"
import { NewInstallatoreDialog } from "@/components/installatori/new-installatore-dialog"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"
import { PermissionPageGuard } from "@/lib/permissions/client-guard"

function norm(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase()
}

// Simula il download di un CSV a partire dagli installatori passati
function downloadInstallatoriCsv(
  rows: InstallatoreRecord[],
  filename: string,
) {
  const cols = INSTALLATORE_COLUMNS.map((c) => c.id)
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

function InstallatoriPageInner() {
  const { tags } = useInstallatoreTags()
  const tagNames = useMemo(() => tags.map((t) => t.name), [tags])

  const [installatori, setInstallatori] = useState<InstallatoreRecord[]>(
    mockInstallatoriRecords,
  )
  const [filters, setFilters] = useState<InstallatoreFilterState>(
    DEFAULT_INSTALLATORE_FILTERS,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const [sortBy, setSortBy] = useState<InstallatoreColumnId | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [visibleCols, setVisibleCols] = useState<InstallatoreColumnId[]>(
    DEFAULT_INSTALLATORE_COLUMNS,
  )
  const [density, setDensity] = useState<Density>("normale")

  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InstallatoreRecord | null>(
    null,
  )

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<InstallatoreSettingsSectionId>("generali")

  // Colonne visibili nell'ordine del registro
  const columns = useMemo(
    () => INSTALLATORE_COLUMNS.filter((c) => visibleCols.includes(c.id)),
    [visibleCols],
  )

  // Applica filtri (ricerca, stato, proprietario, tag)
  const filtered = useMemo(() => {
    const q = norm(filters.search)
    return installatori.filter((i) => {
      if (q) {
        const haystack = [
          i["Nome Installatore"],
          i["E-mail"],
          i["Persona di riferimento"],
          i["Proprietario di Installatore"],
        ]
          .map(norm)
          .join(" ")
        if (!haystack.includes(q)) return false
      }
      if (filters.stato !== "all" && i.Stato !== filters.stato) return false
      if (
        filters.proprietario !== "all" &&
        i["Proprietario di Installatore"] !== filters.proprietario
      )
        return false
      if (filters.tag !== "all" && !i.Tag.includes(filters.tag)) return false
      return true
    })
  }, [installatori, filters])

  // Ordinamento
  const sorted = useMemo(() => {
    if (!sortBy) return filtered
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      const as = Array.isArray(av) ? av.join(", ") : String(av ?? "")
      const bs = Array.isArray(bv) ? bv.join(", ") : String(bv ?? "")
      return as.localeCompare(bs, "it", { numeric: true }) * dir
    })
  }, [filtered, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () =>
      sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage),
    [sorted, safePage, rowsPerPage],
  )

  const selectedRows = useMemo(
    () => filtered.filter((i) => selected.has(i.id)),
    [filtered, selected],
  )

  const handleSort = (col: InstallatoreColumnId) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
  }

  const handleFilterChange = (next: InstallatoreFilterState) => {
    setFilters(next)
    setPage(1)
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
      const allOnPage = pageRows.every((i) => prev.has(i.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((i) => next.delete(i.id))
      else pageRows.forEach((i) => next.add(i.id))
      return next
    })
  }

  const handleCreate = (installatore: InstallatoreRecord) => {
    setInstallatori((prev) => [installatore, ...prev])
    toast.success("Installatore creato", {
      description: `${installatore["Nome Installatore"]} aggiunto all'elenco.`,
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setInstallatori((prev) => prev.filter((i) => i.id !== deleteTarget.id))
    toast.success("Installatore eliminato", {
      description: `${deleteTarget["Nome Installatore"]} rimosso.`,
    })
    setDeleteTarget(null)
  }

  const confirmBulkDelete = () => {
    const n = selected.size
    setInstallatori((prev) => prev.filter((i) => !selected.has(i.id)))
    toast.success("Installatori eliminati", {
      description: `${n} installatori rimossi.`,
    })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  const openSettings = (section: InstallatoreSettingsSectionId) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  const handleBulkTransfer = (owner: string) => {
    const n = selected.size
    setInstallatori((prev) =>
      prev.map((i) =>
        selected.has(i.id)
          ? { ...i, "Proprietario di Installatore": owner }
          : i,
      ),
    )
    toast.success("Proprietario aggiornato", {
      description: `${n} installatori assegnati a ${owner}.`,
    })
    setSelected(new Set())
  }

  const handleBulkUpdate = (field: "Stato" | "Tag", value: string) => {
    const n = selected.size
    setInstallatori((prev) =>
      prev.map((i) => {
        if (!selected.has(i.id)) return i
        if (field === "Stato") {
          return { ...i, Stato: value as InstallatoreRecord["Stato"] }
        }
        // Tag: aggiunge il tag se assente
        if (i.Tag.includes(value)) return i
        return { ...i, Tag: [...i.Tag, value] }
      }),
    )
    toast.success("Aggiornamento di massa", {
      description: `${field} aggiornato su ${n} installatori.`,
    })
    setSelected(new Set())
  }

  const handleBulkDedup = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) {
      toast.info("Nessun duplicato selezionato")
      setSelected(new Set())
      return
    }
    const remove = new Set(idsToRemove)
    setInstallatori((prev) => prev.filter((i) => !remove.has(i.id)))
    toast.success("Duplicati uniti", {
      description: `${idsToRemove.length} installatori duplicati rimossi.`,
    })
    setSelected(new Set())
  }

  const handleExportFiltered = () => {
    downloadInstallatoriCsv(
      filtered,
      `installatori-filtrati-${filtered.length}.csv`,
    )
    toast.success("Esportazione avviata", {
      description: `${filtered.length} installatori filtrati esportati.`,
    })
  }

  const handleExportSelection = () => {
    downloadInstallatoriCsv(
      selectedRows,
      `installatori-selezione-${selectedRows.length}.csv`,
    )
    toast.success("Esportazione avviata", {
      description: `${selectedRows.length} installatori esportati in CSV.`,
    })
  }

  const start = sorted.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1
  const end = Math.min(safePage * rowsPerPage, sorted.length)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Installatori
          </h1>
          <p className="text-sm text-muted-foreground">
            {INSTALLATORI_TOTAL} installatori totali
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Impostazioni installatori (generali, colonne, tag, regole) */}
          <InstallatoreSettingsSheet
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
                aria-label="Impostazioni installatori"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
              </Button>
            }
          />

          {/* Menu azioni (cambia in base alla selezione) */}
          <InstallatoreActionsMenu
            selectedCount={selected.size}
            filtered={filtered}
            selectedRows={selectedRows}
            tags={tagNames}
            onOpenSettings={openSettings}
            onCheckDuplicates={() =>
              toast.info("Controllo duplicati", {
                description: "Seleziona gli installatori per cercare duplicati.",
              })
            }
            onImport={() => setImportOpen(true)}
            onExportFiltered={handleExportFiltered}
            onExportSelection={handleExportSelection}
            onBulkTransfer={handleBulkTransfer}
            onBulkUpdate={handleBulkUpdate}
            onBulkDedup={handleBulkDedup}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          {/* Crea + import (split button) */}
          <InstallatoreCreateButton
            onCreate={() => setNewOpen(true)}
            onImportInstallatori={() => setImportOpen(true)}
            onImportNota={() =>
              toast.info("Importa Nota", {
                description:
                  "L'import delle note sarà disponibile col database reale.",
              })
            }
          />
        </div>
      </div>

      {/* Barra filtri orizzontale (come nella pagina Lead) */}
      <InstallatoreFilters
        filters={filters}
        tags={tagNames}
        onChange={handleFilterChange}
        onReset={() => {
          setFilters(DEFAULT_INSTALLATORE_FILTERS)
          setPage(1)
        }}
      />

      {/* Tabella */}
      <InstallatoreTable
        installatori={pageRows}
        columns={columns}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onDelete={(i) => setDeleteTarget(i)}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        density={density}
      />

      {/* Footer / paginazione */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {selected.size > 0
            ? `${selected.size} selezionati`
            : `Dati Totali ${sorted.length}`}
        </span>
        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            {start} a {end}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 bg-card"
              aria-label="Pagina precedente"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-1 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8 bg-card"
              aria-label="Pagina successiva"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog: nuovo installatore */}
      <NewInstallatoreDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={handleCreate}
      />

      {/* Dialog: import */}
      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="installatori"
      />

      {/* Dialog: eliminazione singola */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina installatore</DialogTitle>
            <DialogDescription>
              Vuoi eliminare{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.["Nome Installatore"]}
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

      {/* Dialog: eliminazione di massa */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina installatori selezionati</DialogTitle>
            <DialogDescription>
              Vuoi eliminare {selected.size} installatori? L&apos;azione non può
              essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Elimina {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function InstallatoriPage() {
  return (
    <PermissionPageGuard page="installatori">
      <InstallatoreTagProvider>
        <InstallatoriPageInner />
      </InstallatoreTagProvider>
    </PermissionPageGuard>
  )
}
