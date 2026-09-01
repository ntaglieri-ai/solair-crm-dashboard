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
import { startNavigationFeedback } from "@/components/navigation/navigation-feedback"
import Link from "next/link"
import {
  MoreHorizontal,
  ExternalLink,
  UserCheck,
  Trash2,
  Loader2,
  GripVertical,
  MapPin,
  SlidersHorizontal,
  UserRound,
  Bell,
  StickyNote,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LIGHTNING,
  RowInlineActions,
  type Density,
} from "@/components/shared/lightning-table"
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
import {
  clampLeadColumnWidth,
  fitLeadColumnWidthsToViewport,
  isLeadDateTimeColumn,
  LEAD_COMPACT_ICON_COLUMN_WIDTH,
  LEAD_DATE_TIME_COLUMN_WIDTH,
  minimumLeadColumnWidth,
} from "@/lib/leads/column-widths"
import { LeadCell, NUMERIC_COLUMNS } from "./lead-cell"
import { LeadTagBadges } from "./tag-controls"
import { LeadRowContextMenu } from "./lead-row-context-menu"
import { usePermissions } from "@/lib/permissions/provider"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import {
  LeadAvatar,
  OrigineBadge,
  StatoLeadBadge,
} from "./lead-utils"
import { useTags } from "@/lib/tag-store"

export type SortDir = "asc" | "desc"
// Ri-esportata per i chiamanti che la importavano da qui prima che le tre
// tabelle condividessero lo stesso contratto di stile.
export type { Density }

const LEAD_TABLE_DENSITY: Record<Density, string> = {
  comoda: "py-3.5 text-[15px]",
  normale: "py-2.5 text-[15px]",
  densa: "py-1.5 text-sm",
}
const LEAD_ROW_HEIGHT: Record<Density, number> = {
  comoda: 68,
  normale: 48,
  densa: 38,
}
const LEAD_ACTIONS_COLUMN_WIDTH = 80
const LEAD_ACTIONS_TOGGLE_WIDTH = 44
const LEAD_LEFT_CONTROLS_WIDTH = 36 + 44

function isCompactIconColumn(column: LeadColumnId) {
  return column === "Badge dell'attività" || column === "Badge di nota"
}

function LeadHeaderLabel({ column }: { column: LeadColumn }) {
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

function LeadMobileList({
  leads,
  selected,
  onToggle,
  onConvert,
  onDelete,
  onDuplicate,
  loading = false,
}: {
  leads: Lead[]
  selected: Set<string>
  onToggle: (id: string) => void
  onConvert: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onDuplicate: (lead: Lead) => void
  loading?: boolean
}) {
  const router = useRouter()
  const permissions = usePermissions()
  const canDelete = permissions.canRecord("lead", "delete")
  const { owners } = useTags()

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center text-base font-medium text-muted-foreground shadow-sm">
        {loading ? "Caricamento lead..." : "Nessun lead corrisponde ai filtri selezionati."}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
      {leads.map((lead) => {
        const owner =
          owners.find((item) => item.id === lead["Lead Proprietario"])?.nome ??
          lead["Lead Proprietario"] ??
          "Non assegnato"
        const luogo = [lead["Città"], lead.Provincia, lead.Sede]
          .filter(Boolean)
          .join(" · ")

        return (
          <article
            key={lead.id}
            role="button"
            tabIndex={0}
            className="grid min-h-[112px] shrink-0 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-[0_14px_34px_-28px_rgb(15_23_42/0.6)] transition-all hover:-translate-y-0.5 hover:border-teal/40 hover:shadow-[0_18px_42px_-30px_rgb(15_23_42/0.65)] active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => {
              startNavigationFeedback()
              router.push(`/leads/${lead.id}`)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              startNavigationFeedback()
              router.push(`/leads/${lead.id}`)
            }}
          >
            <div className="mt-2 shrink-0" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selected.has(lead.id)}
                onCheckedChange={() => onToggle(lead.id)}
                aria-label={`Seleziona ${lead["Nome Lead"]}`}
              />
            </div>

            <LeadAvatar nome={lead["Nome Lead"]} className="mt-0.5 size-11 text-base shadow-md" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                <h3 className="min-w-0 flex-1 break-words text-lg font-black leading-tight text-foreground">
                  {lead["Nome Lead"]}
                </h3>
                <StatoLeadBadge stato={lead["Stato Lead"]} />
              </div>
              <div className="mt-1.5 grid min-w-0 gap-1 text-sm font-medium text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{owner}</span>
                </span>
                {luogo ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{luogo}</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <OrigineBadge origine={lead["Origine Lead"]} />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <LeadTagBadges leadId={lead.id} max={1} />
                </div>
              </div>
            </div>

            <div
              className="col-start-3 flex min-w-0 items-center justify-end gap-0.5"
              onClick={(event) => event.stopPropagation()}
            >
              <QuickContactIcons
                kind="lead"
                recordId={lead.id}
                nome={lead["Nome Lead"]}
                telefono={lead.Telefono}
                email={lead["E-mail"]}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Azioni lead">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                      <ExternalLink data-icon="inline-start" />
                      Apri scheda
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onConvert(lead)}>
                      <UserCheck data-icon="inline-start" />
                      Converti
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDuplicate(lead)}>
                      <ExternalLink data-icon="inline-start" />
                      Duplica
                    </DropdownMenuItem>
                    {canDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(lead)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Elimina
                        </DropdownMenuItem>
                      </>
                    ) : null}
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
  onUpdate,
  onDuplicate,
  onRefresh,
  sortBy,
  sortDir,
  onSort,
  density = "normale",
  loading = false,
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
  onUpdate: (lead: Lead, patch: Partial<Lead>) => void
  onDuplicate: (lead: Lead) => void
  onRefresh: () => void
  sortBy: LeadColumnId | null
  sortDir: SortDir
  onSort: (col: LeadColumnId) => void
  density?: Density
  loading?: boolean
  /** Ref del contenitore scrollabile (per sincronizzare la scrollbar orizzontale esterna). */
  scrollRef?: RefObject<HTMLDivElement | null>
  /** Callback ad ogni scroll del contenitore, riceve l'elemento scrollabile. */
  onScrollerScroll?: (el: HTMLDivElement) => void
}) {
  const router = useRouter()
  const permissions = usePermissions()
  const canDelete = permissions.canRecord("lead", "delete")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [stuck, setStuck] = useState(false)
  const [draggingColumn, setDraggingColumn] = useState<LeadColumnId | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<LeadColumnId | null>(null)
  const [actionsColumnOpen, setActionsColumnOpen] = useState(false)
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollRef = externalScrollRef ?? internalScrollRef
  const [scrollerWidth, setScrollerWidth] = useState(0)
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const actionsColumnWidth = actionsColumnOpen
    ? LEAD_ACTIONS_COLUMN_WIDTH
    : LEAD_ACTIONS_TOGGLE_WIDTH
  const fixedColumnsWidth = LEAD_LEFT_CONTROLS_WIDTH + actionsColumnWidth
  const colSpan = columns.length + 3
  const cellPad = LEAD_TABLE_DENSITY[density]
  const naturalWidths = useMemo(() => {
    const widths = {} as Record<LeadColumnId, number>
    for (const column of columns) {
      if (column.id === "Badge dell'attività" || column.id === "Badge di nota") {
        widths[column.id] = LEAD_COMPACT_ICON_COLUMN_WIDTH
        continue
      }
      if (column.id === "Tag") {
        widths[column.id] = 210
        continue
      }
      if (isLeadDateTimeColumn(column.id)) {
        widths[column.id] = LEAD_DATE_TIME_COLUMN_WIDTH
        continue
      }
      const contentLength = leads.reduce((maximum, lead) => {
        const value = lead[column.id]
        const length = Array.isArray(value)
          ? value.join(", ").length
          : String(value ?? "").length
        return Math.max(maximum, length)
      }, column.label.length)
      const minimum = minimumLeadColumnWidth(column.id)
      widths[column.id] = Math.min(360, Math.max(minimum, contentLength * 7 + 40))
    }
    return widths
  }, [columns, leads])
  const resolvedWidths = useMemo(() => {
    const widths = { ...naturalWidths }
    for (const column of columns) {
      if (columnWidths[column.id]) {
        widths[column.id] = clampLeadColumnWidth(column.id, columnWidths[column.id]!)
      }
    }
    return widths
  }, [columnWidths, columns, naturalWidths])
  const displayWidths = useMemo(() => {
    return fitLeadColumnWidthsToViewport({
      columns: columns.map((column) => column.id),
      preferredWidths: resolvedWidths,
      viewportWidth: scrollerWidth,
      fixedWidth: fixedColumnsWidth,
    })
  }, [columns, fixedColumnsWidth, resolvedWidths, scrollerWidth])
  const tableWidth = useMemo(
    () =>
      fixedColumnsWidth +
      columns.reduce((total, column) => total + displayWidths[column.id], 0),
    [columns, displayWidths, fixedColumnsWidth],
  )

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    column: LeadColumnId,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = displayWidths[column]
    const onMove = (moveEvent: PointerEvent) => {
      onColumnWidthChange(
        column,
        clampLeadColumnWidth(column, startWidth + moveEvent.clientX - startX),
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

  // Deve seguire LEAD_TABLE_DENSITY: con le righe piu' basse, le stime
  // vecchie facevano saltare la scrollbar durante lo scorrimento.
  const estimateSize = LEAD_ROW_HEIGHT[density]

  // eslint-disable-next-line react-hooks/incompatible-library
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
      setScrollerWidth(el.clientWidth)
      setContentWidth(el.scrollWidth)
      setHasXOverflow(el.scrollWidth - el.clientWidth > 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
    // Ricalcola quando cambiano colonne visibili, righe, densità o espansioni.
  }, [scrollRef, columns, leads, density, expanded, tableWidth])

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
      <LeadRowContextMenu
        key={`row-${lead.id}`}
        lead={lead}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onDuplicate={onDuplicate}
        onRefresh={onRefresh}
      >
        <TableRow
          data-index={vIndex}
          onClick={() => {
            startNavigationFeedback()
            router.push(`/leads/${lead.id}`)
          }}
          className={cn(
            LIGHTNING.row,
            isActive &&
              "bg-secondary/60 ring-1 ring-inset ring-teal/40 hover:bg-secondary/60",
          )}
          data-state={selected.has(lead.id) ? "selected" : undefined}
          aria-selected={isActive}
        >
          {/* Chevron espansione */}
          <TableCell
            onClick={(e) => e.stopPropagation()}
            className={cn(LIGHTNING.cell, LIGHTNING.cellSticky, LIGHTNING.cellLeader, cellPad)}
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
            className={cn(LIGHTNING.cell, LIGHTNING.cellSticky, "sticky left-9 z-10", cellPad)}
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
                  LIGHTNING.cell,
                  "overflow-hidden whitespace-nowrap",
                  cellPad,
                  isLeft ? "text-left" : "text-center",
                )}
                style={{
                  width: displayWidths[col.id],
                  minWidth: displayWidths[col.id],
                  maxWidth: displayWidths[col.id],
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
            className={cn(LIGHTNING.cellActions, actionsColumnOpen ? cellPad : "p-0")}
            style={{
              width: actionsColumnWidth,
              minWidth: actionsColumnWidth,
              maxWidth: actionsColumnWidth,
            }}
          >
            {actionsColumnOpen ? (
              <RowInlineActions>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Converti ${lead["Nome Lead"]} a cliente`}
                  onClick={() => onConvert(lead)}
                >
                  <UserCheck className="size-3.5" />
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
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      >
                        <ExternalLink data-icon="inline-start" />
                        Apri
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onConvert(lead)}>
                        <UserCheck data-icon="inline-start" />
                        Converti a cliente
                      </DropdownMenuItem>
                      {canDelete ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(lead)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Elimina
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </RowInlineActions>
            ) : null}
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
      <TableCell colSpan={colSpan} className="bg-secondary/35 p-0">
        <div className="grid grid-cols-1 gap-4 px-6 py-5 animate-in fade-in slide-in-from-top-1 duration-200 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-xl border border-info/15 bg-card/80 p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-info">
              Contatti
            </span>
            <a
              href={`mailto:${lead["E-mail"]}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-base font-semibold text-info hover:underline"
            >
              <IconMail size={15} stroke={1.8} />
              {lead["E-mail"]}
            </a>
            <a
              href={`tel:${lead.Telefono}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 text-base font-semibold text-info hover:underline"
            >
              <IconPhone size={15} stroke={1.8} />
              {lead.Telefono}
            </a>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-warning/20 bg-card/80 p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-warning">
              Campagna
            </span>
            <span className="inline-flex items-start gap-2 text-base font-semibold text-foreground">
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

          <div className="flex flex-col gap-2 rounded-xl border border-teal/20 bg-card/80 p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wide text-teal">
              Note
            </span>
            <p className="text-sm leading-relaxed text-foreground">
              {lead.Descrizione && lead.Descrizione !== ""
                ? lead.Descrizione
                : "Nessuna nota."}
            </p>
            <Link
              href={`/leads/${lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-bold text-navy hover:underline"
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
    <>
      <div className="h-full lg:hidden">
        <LeadMobileList
          leads={leads}
          selected={selected}
          onToggle={onToggle}
          onConvert={onConvert}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          loading={loading}
        />
      </div>

      <div className="relative hidden h-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_18px_45px_-34px_rgb(15_23_42/0.6)] lg:flex lg:max-h-full lg:flex-col">
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
          // I trackpad emettono spesso piccoli delta diagonali anche durante uno
          // scroll verticale. Ignoriamo quella deriva per evitare che la griglia
          // "balli" lateralmente a ogni movimento della rotella.
          const el = e.currentTarget
          if (el.scrollWidth <= el.clientWidth) return
          const absX = Math.abs(e.deltaX)
          const absY = Math.abs(e.deltaY)
          const shiftedWheel = e.shiftKey && absY >= 4
          const intentionalTrackpadX = absX >= 10 && absX > absY * 1.35
          if (!shiftedWheel && !intentionalTrackpadX) return

          e.preventDefault()
          const delta = shiftedWheel ? e.deltaY : e.deltaX
          el.scrollLeft += delta * 0.72
        }}
        className="min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden bg-card outline-none [scroll-behavior:auto] [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] focus-visible:ring-2 focus-visible:ring-ring/40 [scrollbar-color:var(--crm-scrollbar-thumb)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--crm-scrollbar-thumb)] [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:w-2.5"
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
            <col key={column.id} style={{ width: displayWidths[column.id] }} />
          ))}
          <col style={{ width: actionsColumnWidth }} />
        </colgroup>
        <TableHeader className={cn(LIGHTNING.header, stuck && LIGHTNING.headerStuck)}>
          <TableRow className="hover:bg-transparent">
            {/* Espansione */}
            <TableHead className={cn(LIGHTNING.headCell, "sticky left-0 z-30 w-9")} />
            {/* Selezione */}
            <TableHead className={cn(LIGHTNING.headCell, "sticky left-9 z-30 w-11")}>
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {columns.map((col) => {
              const numeric = NUMERIC_COLUMNS.includes(col.id)
              const isLeft = col.id === "Nome Lead" || col.id === "E-mail"
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
                    ) as LeadColumnId
                    if (source && source !== col.id) onColumnReorder(source, col.id)
                    setDraggingColumn(null)
                    setDragOverColumn(null)
                  }}
                  className={cn(
                    LIGHTNING.headCell,
                    "group relative overflow-hidden whitespace-nowrap transition-colors",
                    draggingColumn === col.id && "opacity-45",
                    dragOverColumn === col.id && "bg-teal/10",
                    numeric ? "text-right" : isLeft ? "text-left" : "text-center",
                    compact && "px-1",
                  )}
                  style={{
                    width: displayWidths[col.id],
                    minWidth: displayWidths[col.id],
                    maxWidth: displayWidths[col.id],
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
                          : numeric
                            ? "flex-row-reverse justify-start"
                            : isLeft
                              ? "justify-start"
                              : "justify-center",
                      )}
                    >
                      <LeadHeaderLabel column={col} />
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
            <TableHead
              className={cn(
                LIGHTNING.headCell,
                LIGHTNING.headLabel,
                LIGHTNING.headActions,
                "p-0",
              )}
              style={{
                width: actionsColumnWidth,
                minWidth: actionsColumnWidth,
                maxWidth: actionsColumnWidth,
              }}
            >
              <button
                type="button"
                aria-label={
                  actionsColumnOpen ? "Nascondi colonna azioni" : "Mostra colonna azioni"
                }
                title={
                  actionsColumnOpen ? "Nascondi colonna azioni" : "Mostra colonna azioni"
                }
                onClick={() => setActionsColumnOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <SlidersHorizontal className="size-4" />
              </button>
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
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Caricamento lead...
                  </span>
                ) : (
                  "Nessun lead corrisponde ai filtri selezionati."
                )}
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
          onWheel={(event) => {
            // La barra inferiore gestisce solo l'asse X: una rotella verticale
            // sopra di essa non deve trascinare l'intera pagina.
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
            event.preventDefault()
            const el = scrollRef.current
            if (el) el.scrollTop += event.deltaY
          }}
          aria-hidden
          className="shrink-0 overscroll-contain overflow-x-auto overflow-y-hidden border-t border-border bg-card [scroll-behavior:auto] [scrollbar-color:var(--crm-scrollbar-thumb)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--crm-scrollbar-thumb)] [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:h-2.5"
        >
          <div style={{ width: contentWidth }} className="h-px" />
        </div>
      ) : null}
      </div>
    </>
  )
}
