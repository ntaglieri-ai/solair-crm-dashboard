"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { startNavigationFeedback } from "@/components/navigation/navigation-feedback"
import { MoreHorizontal, ExternalLink, Trash2, GripVertical } from "lucide-react"
import { IconArrowUp } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DataTableShell } from "@/components/ui/data-table-shell"
import {
  LIGHTNING,
  LIGHTNING_DENSITY,
  RowInlineActions,
  type Density,
} from "@/components/shared/lightning-table"
import { ClienteRowContextMenu } from "./cliente-row-context-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  type ClienteRecord,
  type ClienteColumn,
  type ClienteColumnId,
} from "@/lib/mock-data"
import { ClienteCell } from "./cliente-cell"

export type SortDir = "asc" | "desc"
// Ri-esportata per i chiamanti che la importavano da qui prima che le tre
// tabelle condividessero lo stesso contratto di stile.
export type { Density }

// Nome Clienti, E-mail e Tag sono allineati a sinistra; il resto è centrato.
function isLeftAligned(id: ClienteColumnId) {
  return id === "Nome Clienti" || id === "E-mail" || id === "Tag"
}

function columnWidth(id: ClienteColumnId) {
  if (id === "Badge dell'attività" || id === "Badge di nota") return 124
  if (id === "Tag") return 300
  if (id === "Nome Clienti") return 240
  if (id === "E-mail") return 250
  if (id === "Clienti Proprietario") return 220
  if (id === "Installatore") return 210
  if (id === "Ora modifica" || id === "Ora creazione") return 190
  return 170
}

export function ClienteTable({
  clienti,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onDelete,
  onUpdate,
  onRefresh,
  sortBy,
  sortDir,
  onSort,
  density = "normale",
  columnWidths = {},
  onColumnWidthChange,
  onColumnReorder,
}: {
  clienti: ClienteRecord[]
  columns: ClienteColumn[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDelete: (cliente: ClienteRecord) => void
  onUpdate: (cliente: ClienteRecord, patch: Partial<ClienteRecord>) => void
  onRefresh: () => void
  sortBy: ClienteColumnId | null
  sortDir: SortDir
  onSort: (col: ClienteColumnId) => void
  density?: Density
  /** Larghezze personalizzate per colonna (persistite dal chiamante); se assente, usa la larghezza di default di columnWidth(). */
  columnWidths?: Partial<Record<ClienteColumnId, number>>
  onColumnWidthChange?: (column: ClienteColumnId, width: number) => void
  onColumnReorder?: (source: ClienteColumnId, target: ClienteColumnId) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const [draggingColumn, setDraggingColumn] = useState<ClienteColumnId | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ClienteColumnId | null>(null)
  const allSelected =
    clienti.length > 0 && clienti.every((c) => selected.has(c.id))
  const colSpan = columns.length + 2
  const cellPad = LIGHTNING_DENSITY[density]
  const resolvedWidths = useMemo(() => {
    const widths = {} as Record<ClienteColumnId, number>
    for (const column of columns) {
      widths[column.id] = columnWidths[column.id] ?? columnWidth(column.id)
    }
    return widths
  }, [columns, columnWidths])
  const tableWidth =
    44 + columns.reduce((sum, col) => sum + resolvedWidths[col.id], 0) + 64

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    column: ClienteColumnId,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = resolvedWidths[column]
    const onMove = (moveEvent: PointerEvent) => {
      onColumnWidthChange?.(
        column,
        Math.min(480, Math.max(72, startWidth + moveEvent.clientX - startX)),
      )
    }
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
  }

  return (
    <DataTableShell
      ariaLabel="Tabella clienti"
      minTableWidth={tableWidth}
      onScroll={(el) => setStuck(el.scrollTop > 0)}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        {columns.map((column) => (
          <col key={column.id} style={{ width: resolvedWidths[column.id] }} />
        ))}
        <col style={{ width: 64 }} />
      </colgroup>
      <TableHeader className={cn(LIGHTNING.header, stuck && LIGHTNING.headerStuck)}>
          <TableRow className="hover:bg-transparent">
            {/* Selezione */}
            <TableHead className={cn(LIGHTNING.headCell, "sticky left-0 z-30 w-11")}>
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {columns.map((col) => {
              const left = isLeftAligned(col.id)
              const active = sortBy === col.id
              return (
                <TableHead
                  key={col.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", col.id)
                    setDraggingColumn(col.id)
                  }}
                  onDragEnd={() => {
                    setDraggingColumn(null)
                    setDragOverColumn(null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (draggingColumn && draggingColumn !== col.id) {
                      setDragOverColumn(col.id)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const source = event.dataTransfer.getData(
                      "text/plain",
                    ) as ClienteColumnId
                    if (source && source !== col.id) onColumnReorder?.(source, col.id)
                    setDraggingColumn(null)
                    setDragOverColumn(null)
                  }}
                  className={cn(
                    LIGHTNING.headCell,
                    "group relative overflow-hidden whitespace-nowrap transition-colors",
                    draggingColumn === col.id && "opacity-45",
                    dragOverColumn === col.id && "bg-teal/10",
                    left ? "text-left" : "text-center",
                  )}
                  style={{
                    width: resolvedWidths[col.id],
                    minWidth: resolvedWidths[col.id],
                    maxWidth: resolvedWidths[col.id],
                  }}
                >
                  <div className="flex min-w-0 items-center">
                    <GripVertical
                      className="mr-1 size-3.5 shrink-0 cursor-grab text-muted-foreground/45 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => onSort(col.id)}
                      className={cn(
                        "inline-flex min-w-0 flex-1 items-center gap-1 overflow-hidden",
                        LIGHTNING.headLabel,
                        active ? LIGHTNING.headLabelActive : LIGHTNING.headLabelIdle,
                        left ? "justify-start" : "justify-center",
                      )}
                    >
                      <span className="truncate">{col.label}</span>
                      <IconArrowUp
                        size={14}
                        stroke={2}
                        className={cn(
                          "shrink-0 transition-all duration-150",
                          active
                            ? "text-navy opacity-100"
                            : "text-muted-foreground opacity-30",
                          active && sortDir === "desc" && "rotate-180",
                        )}
                      />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Ridimensiona colonna ${col.label}`}
                    draggable={false}
                    onPointerDown={(event) => startResize(event, col.id)}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      onColumnWidthChange?.(col.id, columnWidth(col.id))
                    }}
                    className="absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none before:absolute before:inset-y-2 before:left-1/2 before:w-px before:bg-teal/0 before:transition-colors hover:before:bg-teal"
                  />
                </TableHead>
              )
            })}
            <TableHead
              className={cn(LIGHTNING.headCell, LIGHTNING.headLabel, "sticky right-0 z-30 w-16 text-right")}
            >
              Azioni
            </TableHead>
          </TableRow>
      </TableHeader>
      <TableBody>
          {clienti.map((cliente) => (
            <ClienteRowContextMenu
              key={`ctx-${cliente.id}`}
              cliente={cliente}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onRefresh={onRefresh}
            >
            <TableRow
              key={cliente.id}
              onClick={() => {
                startNavigationFeedback()
                router.push(`/clienti/${cliente.id}`)
              }}
              className={LIGHTNING.row}
              data-state={selected.has(cliente.id) ? "selected" : undefined}
            >
              {/* Selezione */}
              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(LIGHTNING.cell, LIGHTNING.cellSticky, LIGHTNING.cellLeader, cellPad)}
                style={{ width: 44, minWidth: 44, maxWidth: 44 }}
              >
                <Checkbox
                  checked={selected.has(cliente.id)}
                  onCheckedChange={() => onToggle(cliente.id)}
                  aria-label={`Seleziona ${cliente["Nome Clienti"]}`}
                />
              </TableCell>

              {columns.map((col) => {
                const left = isLeftAligned(col.id)
                return (
                  <TableCell
                    key={col.id}
                    className={cn(
                      LIGHTNING.cell,
                      "whitespace-nowrap",
                      cellPad,
                      left ? "text-left" : "text-center",
                    )}
                    style={{
                      width: resolvedWidths[col.id],
                      minWidth: resolvedWidths[col.id],
                      maxWidth: resolvedWidths[col.id],
                    }}
                  >
                    <div
                      className={cn(
                        "flex min-w-0 items-center overflow-hidden",
                        left ? "justify-start" : "justify-center",
                      )}
                    >
                      <ClienteCell
                        cliente={cliente}
                        column={col.id}
                        density={density}
                      />
                    </div>
                  </TableCell>
                )
              })}

              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(LIGHTNING.cellSticky, LIGHTNING.cellActions, cellPad)}
                style={{ width: 64, minWidth: 64, maxWidth: 64 }}
              >
                <RowInlineActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Apri ${cliente["Nome Clienti"]}`}
                    onClick={() => {
                      startNavigationFeedback()
                      router.push(`/clienti/${cliente.id}`)
                    }}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Azioni">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => router.push(`/clienti/${cliente.id}`)}
                        >
                          <ExternalLink data-icon="inline-start" />
                          Apri
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(cliente)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </RowInlineActions>
              </TableCell>
            </TableRow>
            </ClienteRowContextMenu>
          ))}

          {clienti.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colSpan}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                Nessun cliente corrisponde ai filtri selezionati.
              </TableCell>
            </TableRow>
          ) : null}
      </TableBody>
    </DataTableShell>
  )
}
