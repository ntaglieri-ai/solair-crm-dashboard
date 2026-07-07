"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, Trash2, Pencil } from "lucide-react"
import { IconArrowUp, IconNote, IconPaperclip } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableShell } from "@/components/ui/data-table-shell"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Scadenza, isScadenzaScaduta } from "@/lib/mock-data"
import { ScadutaBadge, ScadenzaAvatar } from "./scadenza-utils"

export type SortDir = "asc" | "desc"
export type Density = "comoda" | "normale" | "densa"
export type ScadenzaSortKey =
  | "Nome Scadenze"
  | "Data scadenza"
  | "Proprietario di Scadenze"
  | "Ora modifica"

export type ScadenzaColumnId = ScadenzaSortKey

/** Registro colonne configurabili dell'elenco scadenze. */
export const SCADENZA_COLUMNS: {
  id: ScadenzaColumnId
  label: string
  mandatory?: boolean
}[] = [
  { id: "Nome Scadenze", label: "Nome Scadenze", mandatory: true },
  { id: "Data scadenza", label: "Data scadenza" },
  { id: "Proprietario di Scadenze", label: "Proprietario di Scadenze" },
  { id: "Ora modifica", label: "Ora modifica" },
]

export const DEFAULT_SCADENZA_COLUMNS: ScadenzaColumnId[] =
  SCADENZA_COLUMNS.map((c) => c.id)

const DENSITY_CELL: Record<Density, string> = {
  comoda: "py-4 text-sm",
  normale: "py-2.5 text-sm",
  densa: "py-1 text-xs",
}

const COLUMN_WIDTH: Record<ScadenzaColumnId, number> = {
  "Nome Scadenze": 360,
  "Data scadenza": 190,
  "Proprietario di Scadenze": 260,
  "Ora modifica": 190,
}

export function ScadenzaTable({
  scadenze,
  visibleCols = DEFAULT_SCADENZA_COLUMNS,
  density = "normale",
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  sortBy,
  sortDir,
  onSort,
}: {
  scadenze: Scadenza[]
  visibleCols?: ScadenzaColumnId[]
  density?: Density
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onEdit: (s: Scadenza) => void
  onDelete: (s: Scadenza) => void
  sortBy: ScadenzaSortKey | null
  sortDir: SortDir
  onSort: (col: ScadenzaSortKey) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const allSelected =
    scadenze.length > 0 && scadenze.every((s) => selected.has(s.id))

  // Colonne effettivamente visibili, nell'ordine del registro.
  const columns = SCADENZA_COLUMNS.filter((c) => visibleCols.includes(c.id))
  const cellPad = DENSITY_CELL[density]
  const show = (id: ScadenzaColumnId) => visibleCols.includes(id)
  const tableWidth =
    44 + columns.reduce((sum, col) => sum + COLUMN_WIDTH[col.id], 0) + 64

  return (
    <DataTableShell
      ariaLabel="Tabella scadenze"
      minTableWidth={tableWidth}
      onScroll={(el) => setStuck(el.scrollTop > 0)}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        {columns.map((column) => (
          <col key={column.id} style={{ width: COLUMN_WIDTH[column.id] }} />
        ))}
        <col style={{ width: 64 }} />
      </colgroup>
        <TableHeader
          className={cn(
            "sticky top-0 z-20 bg-muted/95 backdrop-blur transition-shadow duration-150",
            stuck && "shadow-[0_4px_8px_-4px_rgba(0,0,0,0.15)]",
          )}
        >
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-30 w-11 border-r border-foreground/30 bg-muted/95">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutte"
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className="cursor-pointer select-none overflow-hidden whitespace-nowrap border-r border-foreground/30 font-semibold text-muted-foreground"
                style={{
                  width: COLUMN_WIDTH[col.id],
                  minWidth: COLUMN_WIDTH[col.id],
                  maxWidth: COLUMN_WIDTH[col.id],
                }}
                onClick={() => onSort(col.id)}
              >
                <span className="inline-flex max-w-full items-center gap-1">
                  <span className="truncate">{col.label}</span>
                  {sortBy === col.id && (
                    <IconArrowUp
                      size={14}
                      stroke={2}
                      className={cn(
                        "transition-transform",
                        sortDir === "desc" && "rotate-180",
                      )}
                    />
                  )}
                </span>
              </TableHead>
            ))}
            <TableHead className="sticky right-0 z-30 w-16 border-l border-foreground/30 bg-muted/95 text-right" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {scadenze.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + 2}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                Nessuna scadenza trovata con i filtri correnti.
              </TableCell>
            </TableRow>
          ) : (
            scadenze.map((s) => {
              const scaduta = isScadenzaScaduta(s)
              return (
                <TableRow
                  key={s.id}
                  data-state={selected.has(s.id) ? "selected" : undefined}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/scadenze/${s.id}`)}
                >
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className="sticky left-0 z-10 border-r border-border/70 bg-card"
                    style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                  >
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => onToggle(s.id)}
                      aria-label={`Seleziona ${s["Nome Scadenze"]}`}
                    />
                  </TableCell>

                  {/* Nome Scadenze */}
                  <TableCell
                    className={cn("border-r border-border/70", cellPad)}
                    style={{
                      width: COLUMN_WIDTH["Nome Scadenze"],
                      minWidth: COLUMN_WIDTH["Nome Scadenze"],
                      maxWidth: COLUMN_WIDTH["Nome Scadenze"],
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-info hover:underline">
                        {s["Nome Scadenze"]}
                      </span>
                      {s.Note.length > 0 && (
                        <IconNote
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                      {s["Caricamento file 1"] && (
                        <IconPaperclip
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                    </div>
                    {s["Connesso a"] && (
                      <span className="text-xs text-muted-foreground">
                        {s["Connesso a"]}
                      </span>
                    )}
                  </TableCell>

                  {/* Data scadenza */}
                  {show("Data scadenza") && (
                    <TableCell
                      className={cn("border-r border-border/70", cellPad)}
                      style={{
                        width: COLUMN_WIDTH["Data scadenza"],
                        minWidth: COLUMN_WIDTH["Data scadenza"],
                        maxWidth: COLUMN_WIDTH["Data scadenza"],
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "whitespace-nowrap tabular-nums",
                            scaduta
                              ? "font-medium text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {s["Data scadenza"]}
                        </span>
                        {scaduta && <ScadutaBadge />}
                      </div>
                    </TableCell>
                  )}

                  {/* Proprietario */}
                  {show("Proprietario di Scadenze") && (
                    <TableCell
                      className={cn("border-r border-border/70", cellPad)}
                      style={{
                        width: COLUMN_WIDTH["Proprietario di Scadenze"],
                        minWidth: COLUMN_WIDTH["Proprietario di Scadenze"],
                        maxWidth: COLUMN_WIDTH["Proprietario di Scadenze"],
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <ScadenzaAvatar
                          nome={s["Proprietario di Scadenze"]}
                          size={26}
                        />
                        <span className="whitespace-nowrap text-foreground">
                          {s["Proprietario di Scadenze"]}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  {/* Ora modifica */}
                  {show("Ora modifica") && (
                    <TableCell
                      className={cn("border-r border-border/70", cellPad)}
                      style={{
                        width: COLUMN_WIDTH["Ora modifica"],
                        minWidth: COLUMN_WIDTH["Ora modifica"],
                        maxWidth: COLUMN_WIDTH["Ora modifica"],
                      }}
                    >
                      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                        {s["Ora modifica"]}
                      </span>
                    </TableCell>
                  )}

                  {/* Azioni */}
                  <TableCell
                    className={cn(
                      "sticky right-0 z-10 border-l border-border/70 bg-card text-right",
                      cellPad,
                    )}
                    style={{ width: 64, minWidth: 64, maxWidth: 64 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
                            aria-label={`Azioni per ${s["Nome Scadenze"]}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/scadenze/${s.id}`)}
                        >
                          <ExternalLink data-icon="inline-start" />
                          Apri scadenza
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(s)}>
                          <Pencil data-icon="inline-start" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
    </DataTableShell>
  )
}
