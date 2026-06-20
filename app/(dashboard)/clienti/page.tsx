"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, MoreHorizontal } from "lucide-react"
import { IconSettings, IconColumns3 } from "@tabler/icons-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  type Cliente,
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
} from "@/components/clienti/cliente-table"
import { ClienteColumnSheet } from "@/components/clienti/cliente-column-sheet"
import { NewClienteDialog } from "@/components/clienti/new-cliente-dialog"

const ROWS_ITEMS: Record<string, string> = {
  "10": "10 righe",
  "30": "30 righe",
  "50": "50 righe",
}

export default function ClientiPage() {
  const [clienti, setClienti] = useState<Cliente[]>(mockClienti)
  const [filters, setFilters] = useState<ClienteFilterState>(
    DEFAULT_CLIENTE_FILTERS,
  )
  const [newClienteOpen, setNewClienteOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [visibleCols, setVisibleCols] = useState<ClienteColumnId[]>(
    DEFAULT_CLIENTE_COLUMNS,
  )
  const [sortBy, setSortBy] = useState<ClienteColumnId | null>("Ora modifica")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Le colonne visibili sono renderizzate nell'ordine di `visibleCols`.
  const columns = useMemo(
    () =>
      visibleCols
        .map((id) => CLIENTE_COLUMNS.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [visibleCols],
  )

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = clienti.filter((c) => {
      if (q) {
        const haystack = [
          c["Nome Clienti"],
          c["E-mail"],
          c.Cellulare ?? "",
        ]
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
  }, [filters, sortBy, sortDir, clienti])

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const rangeStart = filtered.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + rowsPerPage, filtered.length)

  const handleFilterChange = (next: ClienteFilterState) => {
    setFilters(next)
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_CLIENTE_FILTERS)
    setPage(1)
  }

  const handleCreate = (cliente: Cliente) => {
    setClienti((prev) => [cliente, ...prev])
    setFilters(DEFAULT_CLIENTE_FILTERS)
    setSortBy(null)
    setPage(1)
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

  const confirmDelete = () => {
    if (!deleteTarget) return
    setClienti((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    toast.success("Cliente eliminato", {
      description: `${deleteTarget["Nome Clienti"]} è stato rimosso.`,
    })
    setDeleteTarget(null)
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
          {/* Gestisci colonne */}
          <ClienteColumnSheet
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            visibleCols={visibleCols}
            onVisibleColsChange={setVisibleCols}
            trigger={
              <Button variant="outline" className="bg-card">
                <IconColumns3 size={18} stroke={1.8} data-icon="inline-start" />
                Gestisci colonne
              </Button>
            }
          />

          {/* Impostazioni (placeholder, attivato nel prompt Tag) */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Impostazioni clienti (presto)"
            className="bg-card"
            disabled
          >
            <IconSettings size={18} stroke={1.8} />
          </Button>

          {/* Menu azioni (placeholder vuoto in questo step) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" aria-label="Altre azioni" className="bg-card">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                Nessuna azione disponibile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={() => setNewClienteOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Nuovo cliente
          </Button>
        </div>
      </div>

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

      <NewClienteDialog
        open={newClienteOpen}
        onOpenChange={setNewClienteOpen}
        onCreate={handleCreate}
      />
    </div>
  )
}
