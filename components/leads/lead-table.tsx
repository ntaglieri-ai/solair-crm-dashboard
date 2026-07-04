"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { useRouter } from "next/navigation"
import { useVirtualizer } from "@tanstack/react-virtual"
import Link from "next/link"
import {
  MoreHorizontal,
  ExternalLink,
  UserCheck,
  Trash2,
  GripVertical,
} from "lucide-react"
import {
  IconChevronRight,
  IconArrowUp,
  IconFlame,
  IconMail,
  IconPhone,
  IconSpeakerphone,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  type Lead,
  type LeadColumn,
  type LeadColumnId,
} from "@/lib/mock-data"
import { LeadCell, NUMERIC_COLUMNS } from "./lead-cell"
import { LeadRowContextMenu } from "./lead-row-context-menu"

export type SortDir = "asc" | "desc"
export type Density = "comoda" | "normale" | "densa"

const DENSITY_CELL: Record<Density, string> = {
  comoda: "py-4 text-sm",
  normale: "py-2.5 text-sm",
  densa: "py-1 text-xs",
}

export function LeadTable({
  leads,
  columns,
  columnWidths,
  onColumnWidthChange,
  onColumnReorder,
  selected,
  onToggle,
  onToggleAll,
  onConvert,
  onDelete,
  sortBy,
  sortDir,
  onSort,
  density = "normale",
  scrollRef: externalScrollRef,
  onScrollerScroll,
}: {
  leads: Lead[]
  columns: LeadColumn[]
  columnWidths: Partial<Record<LeadColumnId, number>>
  onColumnWidthChange: (column: LeadColumnId, width: number) => void
  onColumnReorder: (source: LeadColumnId, target: LeadColumnId) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onConvert: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  sortBy: LeadColumnId | null
  sortDir: SortDir
  onSort: (col: LeadColumnId) => void
  density?: Density
  /** Ref del contenitore scrollabile (per sincronizzare la scrollbar orizzontale esterna). */
  scrollRef?: RefObject<HTMLDivElement | null>
  /** Callback ad ogni scroll del contenitore, riceve l'elemento scrollabile. */
  onScrollerScroll?: (el: HTMLDivElement) => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [stuck, setStuck] = useState(false)
  const [draggingColumn, setDraggingColumn] = useState<LeadColumnId | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<LeadColumnId | null>(null)
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = externalScrollRef ?? internalScrollRef
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const colSpan = columns.length + 3
  const cellPad = DENSITY_CELL[density]
  const naturalWidths = useMemo(() => {
    const widths = {} as Record<LeadColumnId, number>
    for (const column of columns) {
      if (column.id === "Badge dell'attività" || column.id === "Badge di nota") {
        widths[column.id] = 74
        continue
      }
      if (column.id === "Tag") {
        widths[column.id] = 210
        continue
      }
      const contentLength = leads.reduce((maximum, lead) => {
        const value = lead[column.id]
        const length = Array.isArray(value)
          ? value.join(", ").length
          : String(value ?? "").length
        return Math.max(maximum, length)
      }, column.label.length)
      const minimum =
        column.id === "Nome Lead"
          ? 190
          : column.id === "E-mail"
            ? 210
            : 116
      widths[column.id] = Math.min(360, Math.max(minimum, contentLength * 7 + 40))
    }
    return widths
  }, [columns, leads])
  const resolvedWidths = useMemo(() => {
    const widths = { ...naturalWidths }
    for (const column of columns) {
      if (columnWidths[column.id]) widths[column.id] = columnWidths[column.id]!
    }
    return widths
  }, [columnWidths, columns, naturalWidths])
  const tableWidth = useMemo(
    () =>
      36 +
      44 +
      56 +
      columns.reduce((total, column) => total + resolvedWidths[column.id], 0),
    [columns, resolvedWidths],
  )

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    column: LeadColumnId,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = resolvedWidths[column]
    const onMove = (moveEvent: PointerEvent) => {
      onColumnWidthChange(
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

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Virtualizzazione righe (@tanstack/react-virtual) ---
  // Lista "piatta" delle righe visive: ogni lead = 1 riga; se espanso, +1 riga
  // di dettaglio. Si virtualizza su questa lista mantenendo la struttura tabella.
  type VisualRow =
    | { kind: "row"; lead: Lead; leadIndex: number }
    | { kind: "expanded"; lead: Lead; leadIndex: number }

  const visualRows = useMemo<VisualRow[]>(() => {
    const out: VisualRow[] = []
    leads.forEach((lead, leadIndex) => {
      out.push({ kind: "row", lead, leadIndex })
      if (expanded.has(lead.id))
        out.push({ kind: "expanded", lead, leadIndex })
    })
    return out
  }, [leads, expanded])

  const estimateSize =
    density === "densa" ? 34 : density === "comoda" ? 58 : 46

  const rowVirtualizer = useVirtualizer({
    count: visualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: 12,
    // Misura dinamica: gestisce l'altezza variabile delle righe espanse.
    measureElement:
      typeof window !== "undefined"
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0

  // --- Navigazione da tastiera (attiva solo quando la tabella è focusata) ---
  const [activeIndex, setActiveIndex] = useState(-1)

  const flatIndexOfLead = useCallback(
    (leadIndex: number) =>
      visualRows.findIndex(
        (r) => r.kind === "row" && r.leadIndex === leadIndex,
      ),
    [visualRows],
  )

  const moveActive = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        const next = Math.min(
          leads.length - 1,
          Math.max(0, (prev < 0 ? (delta > 0 ? -1 : leads.length) : prev) + delta),
        )
        const flat = flatIndexOfLead(next)
        if (flat >= 0) rowVirtualizer.scrollToIndex(flat, { align: "auto" })
        return next
      })
    },
    [leads.length, flatIndexOfLead, rowVirtualizer],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Non interferire con la digitazione in eventuali campi interni.
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return

      const current = leads[activeIndex]
      switch (e.key) {
        case "j":
        case "J":
        case "ArrowDown":
          e.preventDefault()
          moveActive(1)
          break
        case "k":
        case "K":
        case "ArrowUp":
          e.preventDefault()
          moveActive(-1)
          break
        case "Enter":
          if (current) {
            e.preventDefault()
            router.push(`/leads/${current.id}`)
          }
          break
        case "e":
        case "E":
          if (current) {
            e.preventDefault()
            router.push(`/leads/${current.id}?edit=1`)
          }
          break
        case "Escape":
          if (activeIndex >= 0) {
            e.preventDefault()
            setActiveIndex(-1)
          }
          break
      }
    },
    [leads, activeIndex, moveActive, router],
  )

  // --- Scrollbar orizzontale dedicata (sempre in fondo all'area tabella) ---
  // Header e body restano in un'unica <table> (così le larghezze auto delle
  // colonne dinamiche combaciano sempre). Il contenitore verticale nasconde la
  // scrollbar orizzontale nativa; una barra separata, pinnata in basso e
  // sincronizzata via scrollLeft, la sostituisce e si adatta dinamicamente a
  // colonne mostrate/nascoste, ordine e larghezza totale.
  const hScrollRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [hasXOverflow, setHasXOverflow] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      setContentWidth(el.scrollWidth)
      setHasXOverflow(el.scrollWidth - el.clientWidth > 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
    // Ricalcola quando cambiano colonne visibili, righe, densità o espansioni.
  }, [scrollRef, columns, leads, density, expanded])

  // Sync scrollLeft tra contenitore e barra (no loop: scrive solo se differente).
  const syncBarFromContainer = useCallback((el: HTMLDivElement) => {
    const bar = hScrollRef.current
    if (bar && bar.scrollLeft !== el.scrollLeft) bar.scrollLeft = el.scrollLeft
  }, [])
  const syncContainerFromBar = useCallback(() => {
    const bar = hScrollRef.current
    const el = scrollRef.current
    if (bar && el && el.scrollLeft !== bar.scrollLeft)
      el.scrollLeft = bar.scrollLeft
  }, [scrollRef])

  const renderMainRow = (lead: Lead, leadIndex: number, vIndex: number) => {
    const isOpen = expanded.has(lead.id)
    const isActive = leadIndex === activeIndex
    const leftAligned = (id: LeadColumnId) =>
      id === "Nome Lead" || id === "E-mail"
    return (
      <LeadRowContextMenu key={`row-${lead.id}`} lead={lead} onDelete={onDelete}>
        <TableRow
          data-index={vIndex}
          onClick={() => router.push(`/leads/${lead.id}`)}
          className={cn(
            "cursor-pointer",
            isActive &&
              "bg-secondary/60 ring-1 ring-inset ring-teal/40 hover:bg-secondary/60",
          )}
          data-state={selected.has(lead.id) ? "selected" : undefined}
          aria-selected={isActive}
        >
          {/* Chevron espansione */}
          <TableCell
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "sticky left-0 z-10 border-r border-border/70 bg-card",
              cellPad,
            )}
            style={{ width: 36, minWidth: 36, maxWidth: 36 }}
          >
            <button
              type="button"
              aria-label={isOpen ? "Comprimi riga" : "Espandi riga"}
              aria-expanded={isOpen}
              onClick={() => toggleExpand(lead.id)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <IconChevronRight
                size={16}
                stroke={2}
                className={cn(
                  "transition-transform duration-200",
                  isOpen && "rotate-90",
                )}
              />
            </button>
          </TableCell>

          {/* Selezione */}
          <TableCell
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "sticky left-9 z-10 border-r border-border/70 bg-card",
              cellPad,
            )}
            style={{ width: 44, minWidth: 44, maxWidth: 44 }}
          >
            <Checkbox
              checked={selected.has(lead.id)}
              onCheckedChange={() => onToggle(lead.id)}
              aria-label={`Seleziona ${lead["Nome Lead"]}`}
            />
          </TableCell>

          {columns.map((col) => {
            const isLeft = leftAligned(col.id)
            return (
              <TableCell
                key={col.id}
                className={cn(
                  "overflow-hidden whitespace-nowrap border-r border-border/70",
                  cellPad,
                  isLeft ? "text-left" : "text-center",
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
                    isLeft ? "justify-start" : "justify-center",
                  )}
                >
                  <LeadCell lead={lead} column={col.id} density={density} />
                </div>
              </TableCell>
            )
          })}

          <TableCell
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "sticky right-0 z-10 border-l border-border/70 bg-card text-right",
              cellPad,
            )}
            style={{ width: 56, minWidth: 56, maxWidth: 56 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Azioni">
                    <MoreHorizontal />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.push(`/leads/${lead.id}`)}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Apri
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onConvert(lead)}>
                    <UserCheck data-icon="inline-start" />
                    Converti a cliente
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(lead)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </LeadRowContextMenu>
    )
  }

  const renderExpandedRow = (lead: Lead, vIndex: number) => (
    <TableRow
      key={`exp-${lead.id}`}
      data-index={vIndex}
      ref={rowVirtualizer.measureElement}
      className="hover:bg-transparent"
    >
      <TableCell colSpan={colSpan} className="bg-secondary/30 p-0">
        <div className="grid grid-cols-1 gap-4 px-6 py-4 animate-in fade-in slide-in-from-top-1 duration-200 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contatti
            </span>
            <a
              href={`mailto:${lead["E-mail"]}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-sm text-info hover:underline"
            >
              <IconMail size={15} stroke={1.8} />
              {lead["E-mail"]}
            </a>
            <a
              href={`tel:${lead.Telefono}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-sm text-info hover:underline"
            >
              <IconPhone size={15} stroke={1.8} />
              {lead.Telefono}
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Campagna
            </span>
            <span className="inline-flex items-start gap-2 text-sm text-foreground">
              <IconSpeakerphone
                size={15}
                stroke={1.8}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              {lead["campaign name"]}
            </span>
            {lead.Valutazione > 80 ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                <IconFlame size={14} stroke={1.8} />
                Lead caldo
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Note
            </span>
            <p className="text-sm text-foreground">
              {lead.Descrizione && lead.Descrizione !== ""
                ? lead.Descrizione
                : "Nessuna nota."}
            </p>
            <Link
              href={`/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-medium text-navy hover:underline"
            >
              Apri scheda completa
              <IconChevronRight size={14} stroke={2} />
            </Link>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )

  return (
    <div className="flex h-full max-h-full flex-col">
      {/* Area scrollabile: header sticky + body virtualizzato in un'unica table.
          Scrolla verticalmente; orizzontalmente è pilotata dalla barra dedicata. */}
      <div
        ref={scrollRef}
        tabIndex={0}
        role="grid"
        aria-label="Tabella lead"
        onKeyDown={handleKeyDown}
        onScroll={(e) => {
          setStuck(e.currentTarget.scrollTop > 0)
          onScrollerScroll?.(e.currentTarget)
          syncBarFromContainer(e.currentTarget)
        }}
        onWheel={(e) => {
          // Trackpad orizzontale / Shift+rotella: la scrollbar nativa orizzontale
          // è nascosta, quindi pilotiamo scrollLeft manualmente (sync via onScroll).
          const el = e.currentTarget
          if (el.scrollWidth <= el.clientWidth) return
          const horizontal =
            e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
          if (!horizontal) return
          el.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY
        }}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [scrollbar-color:var(--color-muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:w-2.5"
      >
        {/* table semplice (no wrapper shadcn): un solo contenitore di scroll,
            così l'header sticky e la barra orizzontale dedicata funzionano. */}
        <table
          className="caption-bottom table-fixed text-sm"
          data-slot="table"
          style={{ width: tableWidth, minWidth: "100%" }}
        >
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 44 }} />
          {columns.map((column) => (
            <col key={column.id} style={{ width: resolvedWidths[column.id] }} />
          ))}
          <col style={{ width: 56 }} />
        </colgroup>
        <TableHeader
          className={cn(
            "sticky top-0 z-20 bg-muted/95 backdrop-blur transition-shadow duration-150",
            stuck && "shadow-[0_4px_8px_-4px_rgba(0,0,0,0.15)]",
          )}
        >
          <TableRow className="hover:bg-transparent">
            {/* Espansione */}
            <TableHead className="sticky left-0 z-30 w-9 border-r border-foreground/30 bg-muted/95" />
            {/* Selezione */}
            <TableHead className="sticky left-9 z-30 w-11 border-r border-foreground/30 bg-muted/95">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {columns.map((col) => {
              const numeric = NUMERIC_COLUMNS.includes(col.id)
              const isLeft = col.id === "Nome Lead" || col.id === "E-mail"
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
                    ) as LeadColumnId
                    if (source && source !== col.id) onColumnReorder(source, col.id)
                    setDraggingColumn(null)
                    setDragOverColumn(null)
                  }}
                  className={cn(
                    "group relative overflow-hidden whitespace-nowrap border-r border-foreground/30 transition-colors",
                    draggingColumn === col.id && "opacity-45",
                    dragOverColumn === col.id && "bg-teal/10",
                    numeric ? "text-right" : isLeft ? "text-left" : "text-center",
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
                        "inline-flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs font-semibold transition-colors hover:text-foreground",
                        active ? "text-navy" : "text-muted-foreground",
                        numeric
                          ? "flex-row-reverse justify-start"
                          : isLeft
                            ? "justify-start"
                            : "justify-center",
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
                      onColumnWidthChange(col.id, naturalWidths[col.id])
                    }}
                    className="absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none before:absolute before:inset-y-2 before:left-1/2 before:w-px before:bg-teal/0 before:transition-colors hover:before:bg-teal"
                  />
                </TableHead>
              )
            })}
            <TableHead className="sticky right-0 z-30 w-14 border-l border-foreground/30 bg-muted/95 text-right">
              Azioni
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paddingTop > 0 ? (
            <tr aria-hidden="true">
              <td
                colSpan={colSpan}
                className="p-0"
                style={{ height: paddingTop }}
              />
            </tr>
          ) : null}

          {virtualItems.map((vi) => {
            const item = visualRows[vi.index]
            if (!item) return null
            return item.kind === "row"
              ? renderMainRow(item.lead, item.leadIndex, vi.index)
              : renderExpandedRow(item.lead, vi.index)
          })}

          {paddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td
                colSpan={colSpan}
                className="p-0"
                style={{ height: paddingBottom }}
              />
            </tr>
          ) : null}

          {leads.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colSpan}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                Nessun lead corrisponde ai filtri selezionati.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </table>
      </div>

      {/* Scrollbar orizzontale dedicata: sempre in fondo all'area tabella (mai
          dopo le righe virtualizzate), sincronizzata con header e body. */}
      {hasXOverflow ? (
        <div
          ref={hScrollRef}
          onScroll={syncContainerFromBar}
          aria-hidden
          className="shrink-0 overflow-x-auto overflow-y-hidden border-t border-border bg-card [scrollbar-color:var(--color-muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:h-2.5"
        >
          <div style={{ width: contentWidth }} className="h-px" />
        </div>
      ) : null}
    </div>
  )
}
