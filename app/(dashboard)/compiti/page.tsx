"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, Pencil } from "lucide-react"
import {
  IconSettings,
  IconList,
  IconLayoutKanban,
} from "@tabler/icons-react"
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
import {
  mockCompiti,
  COMPITI_TOTAL,
  isCompitoScaduto,
  type Compito,
  type StatoCompito,
} from "@/lib/mock-data"
import {
  CompitoFilters,
  DEFAULT_COMPITO_FILTERS,
  type CompitoFilterState,
} from "@/components/compiti/compito-filters"
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

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

const SAVED_VIEWS: Record<string, string> = {
  "tasks-by-status": "Tasks by Status",
  "my-tasks": "I miei compiti",
  overdue: "Compiti scaduti",
}

type ViewMode = "lista" | "kanban"

// converte DD/MM/YYYY in YYYY-MM-DD per confronto range
function toISO(d: string): string {
  const [day, m, y] = d.split("/")
  if (!day || !m || !y) return ""
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`
}

export default function CompitiPage() {
  const [compiti, setCompiti] = useState<Compito[]>(mockCompiti)
  const [view, setView] = useState<ViewMode>("lista")
  const [savedView, setSavedView] = useState("tasks-by-status")
  const [filters, setFilters] = useState<CompitoFilterState>(
    DEFAULT_COMPITO_FILTERS,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<CompitoSortKey | null>("Data di scadenza")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [newOpen, setNewOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Compito | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<CompitoSettingsSectionId>("stati")

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = compiti.filter((c) => {
      if (q && !c.Oggetto.toLowerCase().includes(q)) return false
      if (filters.stati.length > 0 && !filters.stati.includes(c.Stato))
        return false
      if (filters.priorita !== "all" && c.Priorità !== filters.priorita)
        return false
      if (
        filters.proprietario !== "all" &&
        c["Proprietario del compito"] !== filters.proprietario
      )
        return false
      if (filters.sede !== "all" && c.Sede !== filters.sede) return false
      const iso = toISO(c["Data di scadenza"])
      if (filters.scadenzaDa && iso < filters.scadenzaDa) return false
      if (filters.scadenzaA && iso > filters.scadenzaA) return false
      return true
    })

    if (sortBy) {
      rows.sort((a, b) => {
        let cmp = 0
        if (sortBy === "Data di scadenza") {
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
  }, [compiti, filters, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const rangeStart = filtered.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, filtered.length)

  const handleFilterChange = (next: CompitoFilterState) => {
    setFilters(next)
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_COMPITO_FILTERS)
    setPage(1)
  }

  const handleSort = (col: CompitoSortKey) => {
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
      const allOnPage = pageRows.every((c) => prev.has(c.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((c) => next.delete(c.id))
      else pageRows.forEach((c) => next.add(c.id))
      return next
    })

  const handleCreate = (compito: Compito) => {
    setCompiti((prev) => [compito, ...prev])
    setFilters(DEFAULT_COMPITO_FILTERS)
    setSortBy(null)
    setPage(1)
    toast.success("Compito creato", { description: compito.Oggetto })
  }

  const completaCompito = (id: string) => {
    const now = new Date()
    const stamp = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    setCompiti((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, Stato: "Completato", "Orario di chiusura": stamp }
          : c,
      ),
    )
  }

  const handleMove = (id: string, stato: StatoCompito) => {
    setCompiti((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              Stato: stato,
              "Orario di chiusura":
                stato === "Completato" ? c["Orario di chiusura"] : null,
            }
          : c,
      ),
    )
  }

  const handleBulkTransfer = (owner: string) => {
    const n = selected.size
    setCompiti((prev) =>
      prev.map((c) =>
        selected.has(c.id) ? { ...c, "Proprietario del compito": owner } : c,
      ),
    )
    toast.success("Proprietario aggiornato", {
      description: `${n} compiti assegnati a ${owner}.`,
    })
    setSelected(new Set())
  }

  const handleBulkStato = (stato: StatoCompito) => {
    const n = selected.size
    setCompiti((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, Stato: stato } : c)),
    )
    toast.success("Stato aggiornato", {
      description: `${n} compiti impostati su "${stato}".`,
    })
    setSelected(new Set())
  }

  const handleBulkComplete = () => {
    const n = selected.size
    selected.forEach((id) => completaCompito(id))
    toast.success("Compiti completati", { description: `${n} compiti chiusi.` })
    setSelected(new Set())
  }

  const confirmBulkDelete = () => {
    const n = selected.size
    setCompiti((prev) => prev.filter((c) => !selected.has(c.id)))
    toast.success("Compiti eliminati", { description: `${n} compiti rimossi.` })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  const scaduti = useMemo(
    () => compiti.filter((c) => isCompitoScaduto(c)).length,
    [compiti],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Compiti
          </h1>
          <p className="text-sm text-muted-foreground">
            {COMPITI_TOTAL.toLocaleString("it-IT")} compiti · {scaduti} in
            scadenza
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Vista salvata (solo kanban) */}
          {view === "kanban" ? (
            <div className="flex items-center gap-1.5">
              <Select
                items={SAVED_VIEWS}
                value={savedView}
                onValueChange={(v) => setSavedView(v ?? "")}
              >
                <SelectTrigger
                  className="h-9 w-[180px] bg-card"
                  aria-label="Vista salvata"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(SAVED_VIEWS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="bg-card"
                aria-label="Modifica vista"
                onClick={() =>
                  toast.info("Modifica vista", {
                    description: "Configura colonne e filtri della vista.",
                  })
                }
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          ) : null}

          {/* Toggle Lista / Kanban */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
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
                size="icon"
                aria-label="Impostazioni compiti"
                className="bg-card"
              >
                <IconSettings size={18} stroke={1.8} />
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

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Crea Compito
          </Button>
        </div>
      </div>

      {/* Barra filtri */}
      <CompitoFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Vista */}
      {view === "lista" ? (
        <>
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

          {/* Footer paginazione */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {rangeStart}-{rangeEnd} di {filtered.length} · Dati Totali{" "}
                {COMPITI_TOTAL.toLocaleString("it-IT")}
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
        </>
      ) : (
        <CompitoKanban compiti={filtered} onMove={handleMove} />
      )}

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
              onClick={() => {
                if (deleteTarget)
                  setCompiti((prev) =>
                    prev.filter((c) => c.id !== deleteTarget.id),
                  )
                setDeleteTarget(null)
                toast.success("Compito eliminato")
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
            <Button variant="destructive" onClick={confirmBulkDelete}>
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
