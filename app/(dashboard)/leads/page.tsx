"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"
import {
  IconLayoutList,
  IconList,
  IconListDetails,
  IconDownload,
  IconFileTypeCsv,
  IconDotsVertical,
  IconCopyCheck,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  mockLeads,
  LEAD_TOTAL,
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
import { ColumnManager } from "@/components/leads/column-manager"
import { BulkToolbar } from "@/components/leads/bulk-toolbar"
import { NewLeadDialog } from "@/components/leads/new-lead-dialog"
import { TagSettingsSheet } from "@/components/leads/tag-settings-sheet"
import { cn } from "@/lib/utils"
import {
  AdvancedFilters,
  EMPTY_ADVANCED,
  matchesAdvanced,
  type AdvancedFilterState,
} from "@/components/leads/advanced-filters"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

const DENSITY_OPTIONS: { value: Density; label: string; icon: typeof IconList }[] = [
  { value: "comoda", label: "Compatta", icon: IconLayoutList },
  { value: "normale", label: "Normale", icon: IconList },
  { value: "densa", label: "Densa", icon: IconListDetails },
]

// Simula il download di un file CSV a partire dai lead passati
function downloadLeadsCsv(rows: Lead[], filename: string) {
  const cols = LEAD_COLUMNS.map((c) => c.id)
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

function matchesScore(score: number, filter: LeadFilterState["score"]) {
  if (filter === "caldo") return score > 80
  if (filter === "medio") return score >= 50 && score <= 80
  if (filter === "freddo") return score < 50
  return true
}

// Estrae l'elenco tag unico dal dataset
const ALL_TAGS = Array.from(
  new Set(mockLeads.flatMap((l) => l.Tag)),
).sort((a, b) => a.localeCompare(b))

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilterState>(DEFAULT_FILTERS)
  const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_ADVANCED)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null)
  const [visibleCols, setVisibleCols] = useState<LeadColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS,
  )
  const [sortBy, setSortBy] = useState<LeadColumnId | null>("Valutazione")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [density, setDensity] = useState<Density>("normale")
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const columns = useMemo(
    () => LEAD_COLUMNS.filter((c) => visibleCols.includes(c.id)),
    [visibleCols],
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = leads.filter((lead) => {
      if (onlyDuplicates && !lead.possibileDuplicato) return false
      if (q) {
        const haystack = [
          lead["Nome Lead"],
          lead["E-mail"],
          lead.Telefono,
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (filters.stato !== "all" && lead["Stato Lead"] !== filters.stato)
        return false
      if (filters.sede !== "all" && lead.Sede !== filters.sede) return false
      if (
        filters.commerciale !== "all" &&
        lead["Lead Proprietario"] !== filters.commerciale
      )
        return false
      if (filters.origine !== "all" && lead["Origine Lead"] !== filters.origine)
        return false
      if (filters.tag !== "all" && !lead.Tag.includes(filters.tag)) return false
      if (!matchesScore(lead.Valutazione, filters.score)) return false
      if (!matchesAdvanced(lead, advanced)) return false
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
  }, [filters, advanced, onlyDuplicates, sortBy, sortDir, leads])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const rangeStart = filtered.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, filtered.length)

  const handleFilterChange = (next: LeadFilterState) => {
    setFilters(next)
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setAdvanced(EMPTY_ADVANCED)
    setOnlyDuplicates(false)
    setPage(1)
  }

  const handleAdvancedApply = (next: AdvancedFilterState) => {
    setAdvanced(next)
    setPage(1)
  }

  // Inserisce un nuovo lead in cima all'elenco e riporta alla prima pagina
  const handleCreateLead = (lead: Lead) => {
    setLeads((prev) => [lead, ...prev])
    setFilters(DEFAULT_FILTERS)
    setAdvanced(EMPTY_ADVANCED)
    setOnlyDuplicates(false)
    setSortBy(null)
    setPage(1)
  }

  // Controllo duplicati manuale (avviato da menu): scansiona email/telefono
  const handleCheckDuplicates = () => {
    const found = mockLeads.filter((l) => l.possibileDuplicato).length
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

  const handleSort = (col: LeadColumnId) => {
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
      const allOnPage = pageRows.every((l) => prev.has(l.id))
      const next = new Set(prev)
      if (allOnPage) pageRows.forEach((l) => next.delete(l.id))
      else pageRows.forEach((l) => next.add(l.id))
      return next
    })
  }

  const selectedRows = useMemo(
    () => filtered.filter((l) => selected.has(l.id)),
    [filtered, selected],
  )

  const handleBulkOwner = (owner: string) => {
    toast.success("Proprietario aggiornato", {
      description: `${selected.size} lead assegnati a ${owner}.`,
    })
    setSelected(new Set())
  }

  const handleBulkStato = (stato: string) => {
    toast.success("Stato aggiornato", {
      description: `${selected.size} lead impostati su "${stato}".`,
    })
    setSelected(new Set())
  }

  const handleBulkExport = () => {
    downloadLeadsCsv(selectedRows, `lead-selezione-${selectedRows.length}.csv`)
    toast.success("Esportazione avviata", {
      description: `${selectedRows.length} lead esportati in CSV.`,
    })
  }

  const confirmBulkDelete = () => {
    toast.success("Lead eliminati", {
      description: `${selected.size} lead rimossi.`,
    })
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header pagina */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead</h1>
          <p className="text-sm text-muted-foreground">
            {LEAD_TOTAL.toLocaleString("it-IT")} lead totali nel CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Densità vista */}
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {DENSITY_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = density === opt.value
              return (
                <Tooltip key={opt.value}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={opt.label}
                        aria-pressed={active}
                        onClick={() => setDensity(opt.value)}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md transition-colors duration-150",
                          active
                            ? "border border-navy bg-[#EEF2FF] text-navy"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <Icon size={18} stroke={1.8} />
                      </button>
                    }
                  />
                  <TooltipContent>{opt.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Esporta */}
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="bg-card">
                  <IconDownload size={16} stroke={1.8} data-icon="inline-start" />
                  Esporta
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72 p-1.5">
              <button
                type="button"
                onClick={() => {
                  downloadLeadsCsv(filtered, `lead-filtrati-${filtered.length}.csv`)
                  toast.success("Esportazione avviata", {
                    description: `${LEAD_TOTAL.toLocaleString("it-IT")} lead filtrati esportati.`,
                  })
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-secondary"
              >
                <IconFileTypeCsv size={18} stroke={1.8} className="text-muted-foreground" />
                Esporta tutti i lead filtrati ({LEAD_TOTAL.toLocaleString("it-IT")})
              </button>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={() => {
                  downloadLeadsCsv(selectedRows, `lead-selezione-${selectedRows.length}.csv`)
                  toast.success("Esportazione avviata", {
                    description: `${selectedRows.length} lead selezionati esportati.`,
                  })
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconFileTypeCsv size={18} stroke={1.8} className="text-muted-foreground" />
                Esporta selezione ({selected.size} lead)
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadLeadsCsv(pageRows, `lead-pagina-${pageRows.length}.csv`)
                  toast.success("Esportazione avviata", {
                    description: `${pageRows.length} lead di questa pagina esportati.`,
                  })
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-secondary"
              >
                <IconFileTypeCsv size={18} stroke={1.8} className="text-muted-foreground" />
                Esporta questa pagina ({pageRows.length} lead)
              </button>
            </PopoverContent>
          </Popover>

          <ColumnManager visible={visibleCols} onChange={setVisibleCols} />

          <TagSettingsSheet />

          {/* Menu azioni pagina */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Azioni pagina"
                  className="bg-card"
                >
                  <IconDotsVertical size={18} stroke={1.8} />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleCheckDuplicates}>
                  <IconCopyCheck size={16} stroke={1.8} data-icon="inline-start" />
                  Controlla duplicati
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewLeadOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuovo lead
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

      {/* Barra filtri + pannello filtri avanzati */}
      <div className="flex items-start gap-2">
        <AdvancedFilters
          applied={advanced}
          onApply={handleAdvancedApply}
          tags={ALL_TAGS}
        />
        <div className="min-w-0 flex-1">
          <LeadFilters
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleReset}
            tags={ALL_TAGS}
          />
        </div>
      </div>

      {/* Tabella */}
      <LeadTable
        leads={pageRows}
        columns={columns}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onConvert={(lead) => setConvertTarget(lead)}
        onDelete={(lead) => setDeleteTarget(lead)}
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
            <Button variant="destructive" onClick={() => setDeleteTarget(null)}>
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
              in cliente? Verrà creata una nuova scheda cliente con i dati del lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              onClick={() => setConvertTarget(null)}
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
    </div>
  )
}
