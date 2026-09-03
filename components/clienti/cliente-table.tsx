"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { startNavigationFeedback } from "@/components/navigation/navigation-feedback"
import {
  MoreHorizontal,
  ExternalLink,
  Trash2,
  GripVertical,
  MapPin,
  UserRound,
  Wrench,
  Bell,
  StickyNote,
} from "lucide-react"
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
  RowInlineActions,
  type Density,
} from "@/components/shared/lightning-table"
import { ClienteRowContextMenu } from "./cliente-row-context-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
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
import { useClienteTags } from "@/lib/cliente-tag-store"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { ClienteTagBadges } from "./cliente-tag-controls"

export type SortDir = "asc" | "desc"
// Ri-esportata per i chiamanti che la importavano da qui prima che le tre
// tabelle condividessero lo stesso contratto di stile.
export type { Density }

const CLIENTE_COMPACT_ICON_COLUMN_WIDTH = 56
const CLIENTE_ACTIONS_COLUMN_WIDTH = 76
const CLIENTE_TABLE_DENSITY: Record<Density, string> = {
  comoda: "py-3.5 text-[15px]",
  normale: "py-2.5 text-[15px]",
  densa: "py-1.5 text-sm",
}

// Nome Clienti, E-mail e Tag sono allineati a sinistra; il resto è centrato.
function isLeftAligned(id: ClienteColumnId) {
  return id === "Nome Clienti" || id === "E-mail" || id === "Tag"
}

function isCompactIconColumn(id: ClienteColumnId) {
  return id === "Badge dell'attività" || id === "Badge di nota"
}

function columnWidth(id: ClienteColumnId) {
  if (isCompactIconColumn(id)) return CLIENTE_COMPACT_ICON_COLUMN_WIDTH
  if (id === "Tag") return 300
  if (id === "Nome Clienti") return 240
  if (id === "E-mail") return 250
  if (id === "Clienti Proprietario") return 220
  if (id === "Installatore") return 210
  if (id === "Ora modifica" || id === "Ora creazione") return 190
  return 170
}

function minimumColumnWidth(id: ClienteColumnId) {
  return isCompactIconColumn(id) ? CLIENTE_COMPACT_ICON_COLUMN_WIDTH : 72
}

function ClienteHeaderLabel({ column }: { column: ClienteColumn }) {
  if (column.id !== "Badge dell'attività" && column.id !== "Badge di nota") {
    return <span className="truncate">{column.label}</span>
  }

  const Icon = column.id === "Badge dell'attività" ? Bell : StickyNote
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex items-center justify-center">
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{column.label}</span>
          </span>
        }
      />
      <TooltipContent>{column.label}</TooltipContent>
    </Tooltip>
  )
}

function ActionsHeaderLabel() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex items-center justify-center">
            <MoreHorizontal className="size-4" aria-hidden="true" />
            <span className="sr-only">Azioni</span>
          </span>
        }
      />
      <TooltipContent>Azioni</TooltipContent>
    </Tooltip>
  )
}

function ClienteMobileList({
  clienti,
  selected,
  onToggle,
  onDelete,
}: {
  clienti: ClienteRecord[]
  selected: Set<string>
  onToggle: (id: string) => void
  onDelete: (cliente: ClienteRecord) => void
}) {
  const router = useRouter()
  const { ownerNames } = useClienteTags()

  if (clienti.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center text-base font-medium text-muted-foreground shadow-sm">
        Nessun cliente corrisponde ai filtri selezionati.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
      {clienti.map((cliente) => {
        const owner = cliente["Clienti Proprietario"]
          ? ownerNames[cliente["Clienti Proprietario"]] ?? "Utente non disponibile"
          : "Non assegnato"

        return (
          <article
            key={cliente.id}
            role="button"
            tabIndex={0}
            className="grid min-h-[112px] shrink-0 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-[0_14px_34px_-28px_rgb(15_23_42/0.6)] transition-all hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-[0_18px_42px_-30px_rgb(15_23_42/0.65)] active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => {
              startNavigationFeedback()
              router.push(`/clienti/${cliente.id}`)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              startNavigationFeedback()
              router.push(`/clienti/${cliente.id}`)
            }}
          >
            <div className="mt-2 shrink-0" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selected.has(cliente.id)}
                onCheckedChange={() => onToggle(cliente.id)}
                aria-label={`Seleziona ${cliente["Nome Clienti"]}`}
              />
            </div>

            <ClienteAvatar nome={cliente["Nome Clienti"]} className="mt-0.5 size-11 text-base shadow-md" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                <h3 className="min-w-0 flex-1 break-words text-lg font-black leading-tight text-foreground">
                  {cliente["Nome Clienti"]}
                </h3>
                <StatoClienteBadge stato={cliente.Stato} />
              </div>

              <div className="mt-1.5 grid min-w-0 gap-1 text-sm font-medium text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{owner}</span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Wrench className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {cliente.Installatore || "Installatore non assegnato"}
                  </span>
                </span>
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{cliente.Sede}</span>
                </span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <ClienteTagBadges clienteId={cliente.id} max={1} />
                </div>
              </div>
            </div>

            <div
              className="col-start-3 flex min-w-0 items-center justify-end gap-0.5"
              onClick={(event) => event.stopPropagation()}
            >
              <QuickContactIcons
                kind="cliente"
                recordId={cliente.id}
                nome={cliente["Nome Clienti"]}
                telefono={cliente.Cellulare}
                email={cliente["E-mail"]}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Azioni cliente">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => router.push(`/clienti/${cliente.id}`)}
                    >
                      <ExternalLink data-icon="inline-start" />
                      Apri scheda
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
            </div>
          </article>
        )
      })}
    </div>
  )
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
  const cellPad = CLIENTE_TABLE_DENSITY[density]
  const resolvedWidths = useMemo(() => {
    const widths = {} as Record<ClienteColumnId, number>
    for (const column of columns) {
      widths[column.id] = columnWidths[column.id] ?? columnWidth(column.id)
    }
    return widths
  }, [columns, columnWidths])
  const tableWidth =
    44 +
    columns.reduce((sum, col) => sum + resolvedWidths[col.id], 0) +
    CLIENTE_ACTIONS_COLUMN_WIDTH

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
        Math.min(
          480,
          Math.max(
            minimumColumnWidth(column),
            startWidth + moveEvent.clientX - startX,
          ),
        ),
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
    <>
      <div className="lg:hidden">
        <ClienteMobileList
          clienti={clienti}
          selected={selected}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      </div>

      <div className="hidden lg:block">
        <DataTableShell
          ariaLabel="Tabella clienti"
          minTableWidth={tableWidth}
          alwaysShowVerticalScrollbar
          onScroll={(el) => setStuck(el.scrollTop > 0)}
        >
      <colgroup>
        <col style={{ width: 44 }} />
        {columns.map((column) => (
          <col key={column.id} style={{ width: resolvedWidths[column.id] }} />
        ))}
        <col style={{ width: CLIENTE_ACTIONS_COLUMN_WIDTH }} />
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
              const compact = isCompactIconColumn(col.id)
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
                    compact && "px-1",
                  )}
                  style={{
                    width: resolvedWidths[col.id],
                    minWidth: resolvedWidths[col.id],
                    maxWidth: resolvedWidths[col.id],
                  }}
                >
                  <div
                    className={cn(
                      "flex min-w-0 items-center",
                      compact && "justify-center",
                    )}
                  >
                    <GripVertical
                      className={cn(
                        "size-3.5 shrink-0 cursor-grab text-muted-foreground/45 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing",
                        compact
                          ? "absolute left-0.5 top-1/2 -translate-y-1/2"
                          : "mr-1",
                      )}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => onSort(col.id)}
                      className={cn(
                        "inline-flex min-w-0 flex-1 items-center gap-1 overflow-hidden",
                        LIGHTNING.headLabel,
                        active ? LIGHTNING.headLabelActive : LIGHTNING.headLabelIdle,
                        compact
                          ? "justify-center gap-0.5"
                          : left
                            ? "justify-start"
                            : "justify-center",
                      )}
                    >
                      <ClienteHeaderLabel column={col} />
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
              className={cn(LIGHTNING.headCell, LIGHTNING.headLabel, LIGHTNING.headActions)}
              style={{
                width: CLIENTE_ACTIONS_COLUMN_WIDTH,
                minWidth: CLIENTE_ACTIONS_COLUMN_WIDTH,
                maxWidth: CLIENTE_ACTIONS_COLUMN_WIDTH,
              }}
            >
              <ActionsHeaderLabel />
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
                      col.id === "Nome Clienti" ? "whitespace-normal" : "whitespace-nowrap",
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
                className={cn(LIGHTNING.cellActions, cellPad)}
                style={{
                  width: CLIENTE_ACTIONS_COLUMN_WIDTH,
                  minWidth: CLIENTE_ACTIONS_COLUMN_WIDTH,
                  maxWidth: CLIENTE_ACTIONS_COLUMN_WIDTH,
                }}
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
      </div>
    </>
  )
}
