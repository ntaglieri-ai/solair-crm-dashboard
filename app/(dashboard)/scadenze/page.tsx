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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockScadenze,
  SCADENZE_TOTAL,
  type Scadenza,
} from "@/lib/mock-data"
import {
  ScadenzaFilters,
  DEFAULT_SCADENZA_FILTERS,
  type ScadenzaFilterState,
} from "@/components/scadenze/scadenza-filters"
import {
  ScadenzaTable,
  DEFAULT_SCADENZA_COLUMNS,
  type ScadenzaColumnId,
  type ScadenzaSortKey,
  type SortDir,
  type Density,
} from "@/components/scadenze/scadenza-table"
import { ScadenzaActionsMenu } from "@/components/scadenze/scadenza-actions-menu"
import {
  ScadenzaSettingsSheet,
  type ScadenzaSettingsSectionId,
} from "@/components/scadenze/scadenza-settings-sheet"
import { ScadenzaCreateButton } from "@/components/scadenze/scadenza-create-button"
import { ScadenzaFormDialog } from "@/components/scadenze/scadenza-form-dialog"
import { LeadImportDialog } from "@/components/leads/lead-import-dialog"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

// "DD/MM/YYYY HH:MM" → "YYYY-MM-DD" per confronto range
function toISO(d: string): string {
  const [datePart] = d.split(" ")
  const [day, m, y] = datePart.split("/")
  if (!day || !m || !y) return ""
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`
}

export default function ScadenzePage() {
  const [scadenze, setScadenze] = useState<Scadenza[]>(mockScadenze)
  const [filters, setFilters] = useState<ScadenzaFilterState>(
    DEFAULT_SCADENZA_FILTERS,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<ScadenzaSortKey | null>("Data scadenza")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Scadenza | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Scadenza | null>(null)
  const [visibleCols, setVisibleCols] = useState<ScadenzaColumnId[]>(
    DEFAULT_SCADENZA_COLUMNS,
  )
  const [density, setDensity] = useState<Density>("normale")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<ScadenzaSettingsSectionId>("generali")
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = scadenze.filter((s) => {
      if (q && !s["Nome Scadenze"].toLowerCase().includes(q)) return false
      if (
        filters.proprietario !== "all" &&
        s["Proprietario di Scadenze"] !== filters.proprietario
      )
        return false
      const iso = toISO(s["Data scadenza"])
      if (filters.scadenzaDa && iso < filters.scadenzaDa) return false
      if (filters.scadenzaA && iso > filters.scadenzaA) return false
      return true
    })

    if (sortBy) {
      rows.sort((a, b) => {
        let cmp = 0
        if (sortBy === "Data scadenza" || sortBy === "Ora modifica") {
          cmp = toISO(a[sortBy]).localeCompare(toISO(b[sortBy]))
        } else {
          cmp = String(a[sortBy] ?? "").localeCompare(
            String(b[sortBy] ?? ""),
            "it",
          )
        }
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return rows
  }, [scadenze, filters, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const rangeStart = filtered.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, filtered.length)

  const selectedRows = useMemo(
    () => filtered.filter((s) => selected.has(s.id)),
    [filtered, selected],
  )

  const handleFilterChange = (next: ScadenzaFilterState) => {
    setFilters(next)
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_SCADENZA_FILTERS)
    setPage(1)
  }

  const handleSort = (col: ScadenzaSortKey) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
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

  const handleSave = (scadenza: Scadenza, keepOpen: boolean) => {
    setScadenze((prev) => {
      const exists = prev.some((s) => s.id === scadenza.id)
      if (exists) return prev.map((s) => (s.id === scadenza.id ? scadenza : s))
      return [scadenza, ...prev]
    })
    const wasEdit = editTarget !== null
    toast.success(wasEdit ? "Scadenza aggiornata" : "Scadenza creata", {
      description: scadenza["Nome Scadenze"],
    })
    if (!keepOpen) setEditTarget(null)
  }

  const openCreate = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

  const openEdit = (s: Scadenza) => {
    setEditTarget(s)
    setFormOpen(true)
  }

  const confirmBulkDelete = () => {
    const n = selected.size
    setScadenze((prev) => prev.filter((s) => !selected.has(s.id)))
    toast.success("Scadenze eliminate", { description: `${n} scadenze rimosse.` })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  const openSettings = (section: ScadenzaSettingsSectionId) => {
    setSettingsSection(section)
    setSettingsOpen(true)
  }

  const handleBulkTransfer = (owner: string) => {
    const n = selected.size
    setScadenze((prev) =>
      prev.map((s) =>
        selected.has(s.id) ? { ...s, "Proprietario di Scadenze": owner } : s,
      ),
    )
    toast.success("Proprietario aggiornato", {
      description: `${n} scadenze assegnate a ${owner}.`,
    })
    setSelected(new Set())
  }

  // ISO date (input "date") → "DD/MM/YYYY HH:MM" coerente col dataset
  const handleBulkUpdateDate = (iso: string) => {
    const [y, m, d] = iso.split("-")
    if (!y || !m || !d) return
    const formatted = `${d}/${m}/${y} 00:00`
    const n = selected.size
    setScadenze((prev) =>
      prev.map((s) =>
        selected.has(s.id) ? { ...s, "Data scadenza": formatted } : s,
      ),
    )
    toast.success("Data scadenza aggiornata", {
      description: `${n} scadenze impostate al ${d}/${m}/${y}.`,
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
    setScadenze((prev) => prev.filter((s) => !remove.has(s.id)))
    toast.success("Duplicati uniti", {
      description: `${idsToRemove.length} scadenze duplicate rimosse.`,
    })
    setSelected(new Set())
  }

  // Esporta in CSV un insieme di scadenze
  const downloadCsv = (rows: Scadenza[], filename: string) => {
    const cols = [
      "Nome Scadenze",
      "Data scadenza",
      "Proprietario di Scadenze",
      "Connesso a",
      "Ora modifica",
    ] as const
    const header = cols.join(";")
    const body = rows
      .map((r) =>
        cols
          .map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`)
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

  const handleExportFiltered = () => {
    downloadCsv(filtered, `scadenze-filtrate-${filtered.length}.csv`)
    toast.success("Esportazione avviata", {
      description: `${filtered.length} scadenze filtrate esportate.`,
    })
  }

  const handleExportSelection = () => {
    downloadCsv(selectedRows, `scadenze-selezione-${selectedRows.length}.csv`)
    toast.success("Esportazione avviata", {
      description: `${selectedRows.length} scadenze esportate in CSV.`,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Scadenze
          </h1>
          <p className="text-sm text-muted-foreground">
            {SCADENZE_TOTAL} scadenze
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Impostazioni scadenze (generali, colonne, tag, regole) */}
          <ScadenzaSettingsSheet
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
                aria-label="Impostazioni scadenze"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
              </Button>
            }
          />

          {/* Menu azioni (cambia in base alla selezione) */}
          <ScadenzaActionsMenu
            selectedCount={selected.size}
            filtered={filtered}
            selectedRows={selectedRows}
            onOpenSettings={openSettings}
            onImport={() => setImportOpen(true)}
            onExportFiltered={handleExportFiltered}
            onExportSelection={handleExportSelection}
            onBulkTransfer={handleBulkTransfer}
            onBulkUpdateDate={handleBulkUpdateDate}
            onBulkDedup={handleBulkDedup}
            onBulkDelete={() => setBulkDeleteOpen(true)}
          />

          {/* Crea + import (split button) */}
          <ScadenzaCreateButton
            onCreate={openCreate}
            onImportScadenze={() => setImportOpen(true)}
            onImportNota={() =>
              toast.info("Importa Nota", {
                description:
                  "L'import delle note sarà disponibile col database reale.",
              })
            }
          />
        </div>
      </div>

      {/* Barra filtri */}
      <ScadenzaFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Tabella */}
      <ScadenzaTable
        scadenze={pageRows}
        visibleCols={visibleCols}
        density={density}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onEdit={openEdit}
        onDelete={(s) => setDeleteTarget(s)}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {/* Footer paginazione */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {rangeStart}-{rangeEnd} di {filtered.length} · Dati Totali{" "}
            {SCADENZE_TOTAL}
            {selected.size > 0 ? ` · ${selected.size} selezionate` : ""}
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

      {/* Dialog elimina singola */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina scadenza</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.["Nome Scadenze"] ?? ""}
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
              onClick={() => {
                if (deleteTarget)
                  setScadenze((prev) =>
                    prev.filter((s) => s.id !== deleteTarget.id),
                  )
                setDeleteTarget(null)
                toast.success("Scadenza eliminata")
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
            <DialogTitle>Elimina scadenze selezionate</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {selected.size} scadenze
              </span>
              ? L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>
              Elimina {selected.size} scadenze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScadenzaFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditTarget(null)
        }}
        onSave={handleSave}
        scadenza={editTarget}
      />

      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="scadenze"
      />
    </div>
  )
}
