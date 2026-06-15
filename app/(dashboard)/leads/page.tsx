"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react"
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
  mockLeads,
  DUPLICATI_COUNT,
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
import { LeadTable, type SortDir } from "@/components/leads/lead-table"
import { ColumnManager } from "@/components/leads/column-manager"
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
  const [filters, setFilters] = useState<LeadFilterState>(DEFAULT_FILTERS)
  const [advanced, setAdvanced] = useState<AdvancedFilterState>(EMPTY_ADVANCED)
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
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

  const columns = useMemo(
    () => LEAD_COLUMNS.filter((c) => visibleCols.includes(c.id)),
    [visibleCols],
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = mockLeads.filter((lead) => {
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
  }, [filters, advanced, onlyDuplicates, sortBy, sortDir])

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
          <ColumnManager visible={visibleCols} onChange={setVisibleCols} />
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
            <Plus data-icon="inline-start" />
            Nuovo lead
          </Button>
        </div>
      </div>

      {/* Banner duplicati */}
      {bannerVisible ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-warning" />
          <p className="flex-1 text-sm text-foreground">
            Rilevati{" "}
            <span className="font-semibold">{DUPLICATI_COUNT} possibili duplicati</span>{" "}
            per email o telefono. Verifica e unisci i record sospetti.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-warning/40 bg-card text-foreground"
            onClick={() => {
              setOnlyDuplicates(true)
              setPage(1)
            }}
          >
            Verifica duplicati
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Chiudi banner"
            onClick={() => setBannerVisible(false)}
          >
            <X />
          </Button>
        </div>
      ) : null}

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
    </div>
  )
}
