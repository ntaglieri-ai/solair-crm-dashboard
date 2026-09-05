"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, ExternalLink, LinkIcon, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react"
import { startNavigationFeedback } from "@/components/navigation/navigation-feedback"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import type { ScadenzaSortKey, SortDir } from "@/lib/scadenze/api-types"
import { ScadutaBadge, ScadenzaAvatar } from "./scadenza-utils"
import { ScadenzaTagChip } from "./scadenza-tag-picker"
import { ScadenzaRowContextMenu } from "./scadenza-row-context-menu"
import { estimateColumnWidth } from "@/lib/shared/table-column-widths"

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function isScaduta(s: ScadenzaRecord) {
  return new Date(s.data_scadenza).getTime() < Date.now()
}

const SCADENZA_COLUMNS = [
  { id: "nome", label: "Nome", sortKey: "nome" as ScadenzaSortKey },
  { id: "proprietario_nome", label: "Proprietario", sortKey: "proprietario_nome" as ScadenzaSortKey },
  { id: "tag", label: "Tag", sortKey: null },
  { id: "collegamento", label: "Collegamento", sortKey: null },
  { id: "data_scadenza", label: "Data scadenza", sortKey: "data_scadenza" as ScadenzaSortKey },
  { id: "updated_at", label: "Aggiornata", sortKey: "updated_at" as ScadenzaSortKey },
] as const

type ScadenzaColumnId = (typeof SCADENZA_COLUMNS)[number]["id"]

const COLUMN_WIDTH_BOUNDS: Record<ScadenzaColumnId, { min: number; max: number; padding?: number }> = {
  nome: { min: 320, max: 560 },
  proprietario_nome: { min: 200, max: 360 },
  tag: { min: 190, max: 380, padding: 70 },
  collegamento: { min: 150, max: 190, padding: 58 },
  data_scadenza: { min: 210, max: 260 },
  updated_at: { min: 210, max: 260 },
}

function scadenzaColumnValue(scadenza: ScadenzaRecord, column: ScadenzaColumnId) {
  if (column === "collegamento") {
    return scadenza.connesso_a_tipo
      ? scadenza.connesso_a_tipo === "lead"
        ? "Lead"
        : "Cliente"
      : "—"
  }
  if (column === "data_scadenza") return formatDateTime(scadenza.data_scadenza)
  if (column === "updated_at") return formatDateTime(scadenza.updated_at)
  return scadenza[column] ?? "—"
}

function ScadenzaMobileList({
  scadenze,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  scadenze: ScadenzaRecord[]
  selected: Set<string>
  onToggle: (id: string) => void
  onEdit: (s: ScadenzaRecord) => void
  onDelete: (s: ScadenzaRecord) => void
}) {
  const router = useRouter()

  if (scadenze.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        Nessuna scadenza trovata con i filtri correnti.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
      {scadenze.map((scadenza) => {
        const scaduta = isScaduta(scadenza)

        return (
          <article
            key={scadenza.id}
            role="button"
            tabIndex={0}
            className="grid min-h-[108px] shrink-0 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => {
              startNavigationFeedback()
              router.push(`/scadenze/${scadenza.id}`)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              startNavigationFeedback()
              router.push(`/scadenze/${scadenza.id}`)
            }}
          >
            <div className="mt-1.5 shrink-0" onClick={(event) => event.stopPropagation()}>
              <Checkbox
                checked={selected.has(scadenza.id)}
                onCheckedChange={() => onToggle(scadenza.id)}
                aria-label={`Seleziona ${scadenza.nome}`}
              />
            </div>

            <span className="mt-0.5">
              <ScadenzaAvatar nome={scadenza.proprietario_nome ?? scadenza.nome} size={36} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
                <h3 className="min-w-0 flex-1 break-words text-base font-bold leading-tight text-foreground">
                  {scadenza.nome}
                </h3>
                {scaduta ? <ScadutaBadge /> : null}
              </div>

              <div className="mt-1 grid min-w-0 gap-1 text-sm text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <CalendarClock className={cn("size-3.5 shrink-0", scaduta && "text-destructive")} />
                  <span className={cn("truncate", scaduta && "font-medium text-destructive")}>
                    {formatDateTime(scadenza.data_scadenza)}
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {scadenza.proprietario_nome ?? "Proprietario non assegnato"}
                  </span>
                </span>
              </div>

              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <ScadenzaTagChip tag={scadenza.tag} />
                <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <LinkIcon className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {scadenza.connesso_a_tipo
                      ? scadenza.connesso_a_tipo === "lead"
                        ? "Collegata a lead"
                        : "Collegata a cliente"
                      : "Nessun collegamento"}
                  </span>
                </span>
              </div>
            </div>

            <div className="col-start-3 flex justify-end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Azioni per ${scadenza.nome}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => router.push(`/scadenze/${scadenza.id}`)}>
                    <ExternalLink data-icon="inline-start" />
                    Apri scadenza
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(scadenza)}>
                    <Pencil data-icon="inline-start" />
                    Modifica
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(scadenza)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function ScadenzaTable({
  scadenze,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  sortBy,
  sortDir,
  onSort,
}: {
  scadenze: ScadenzaRecord[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onEdit: (s: ScadenzaRecord) => void
  onDelete: (s: ScadenzaRecord) => void
  sortBy: ScadenzaSortKey | null
  sortDir: SortDir
  onSort: (col: ScadenzaSortKey) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const allSelected = scadenze.length > 0 && scadenze.every((s) => selected.has(s.id))
  const columnWidths = useMemo(() => {
    const widths = {} as Record<ScadenzaColumnId, number>
    for (const column of SCADENZA_COLUMNS) {
      const bounds = COLUMN_WIDTH_BOUNDS[column.id]
      widths[column.id] = estimateColumnWidth({
        label: column.label,
        values: scadenze.map((scadenza) => scadenzaColumnValue(scadenza, column.id)),
        min: bounds.min,
        max: bounds.max,
        padding: bounds.padding ?? 48,
      })
    }
    return widths
  }, [scadenze])
  const tableWidth =
    44 + SCADENZA_COLUMNS.reduce((sum, column) => sum + columnWidths[column.id], 0) + 64

  return (
    <>
      <div className="lg:hidden">
        <ScadenzaMobileList
          scadenze={scadenze}
          selected={selected}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      <div className="hidden lg:block">
        <DataTableShell
      ariaLabel="Tabella scadenze"
      minTableWidth={tableWidth}
      alwaysShowVerticalScrollbar
      onScroll={(el) => setStuck(el.scrollTop > 0)}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        {SCADENZA_COLUMNS.map((column) => (
          <col key={column.id} style={{ width: columnWidths[column.id] }} />
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
          {SCADENZA_COLUMNS.map((col) => (
            <TableHead
              key={col.id}
              className={cn(
                "overflow-hidden whitespace-nowrap border-r border-foreground/30 font-semibold text-muted-foreground",
                col.sortKey && "cursor-pointer select-none",
              )}
              style={{
                width: columnWidths[col.id],
                minWidth: columnWidths[col.id],
                maxWidth: columnWidths[col.id],
              }}
              onClick={() => col.sortKey && onSort(col.sortKey)}
            >
              <span className="inline-flex max-w-full items-center gap-1">
                <span className="truncate">{col.label}</span>
                {col.sortKey && sortBy === col.sortKey && (
                  <IconArrowUp
                    size={14}
                    stroke={2}
                    className={cn("transition-transform", sortDir === "desc" && "rotate-180")}
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
            <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
              Nessuna scadenza trovata con i filtri correnti.
            </TableCell>
          </TableRow>
        ) : (
          scadenze.map((s) => {
            const scaduta = isScaduta(s)
            return (
              <ScadenzaRowContextMenu key={s.id} scadenza={s} onEdit={onEdit} onDelete={onDelete}>
              <TableRow
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
                    aria-label={`Seleziona ${s.nome}`}
                  />
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{ width: columnWidths.nome, minWidth: columnWidths.nome, maxWidth: columnWidths.nome }}
                >
                  <span className="block min-w-0 truncate font-medium text-foreground">{s.nome}</span>
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: columnWidths.proprietario_nome,
                    minWidth: columnWidths.proprietario_nome,
                    maxWidth: columnWidths.proprietario_nome,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                    <ScadenzaAvatar nome={s.proprietario_nome ?? "—"} size={26} />
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {s.proprietario_nome ?? "—"}
                    </span>
                  </div>
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{ width: columnWidths.tag, minWidth: columnWidths.tag, maxWidth: columnWidths.tag }}
                >
                  <ScadenzaTagChip tag={s.tag} />
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: columnWidths.collegamento,
                    minWidth: columnWidths.collegamento,
                    maxWidth: columnWidths.collegamento,
                  }}
                >
                  {s.connesso_a_tipo ? (
                    <Badge variant="outline">
                      {s.connesso_a_tipo === "lead" ? "Lead" : "Cliente"}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: columnWidths.data_scadenza,
                    minWidth: columnWidths.data_scadenza,
                    maxWidth: columnWidths.data_scadenza,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "whitespace-nowrap text-sm tabular-nums",
                        scaduta ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatDateTime(s.data_scadenza)}
                    </span>
                    {scaduta && <ScadutaBadge />}
                  </div>
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: columnWidths.updated_at,
                    minWidth: columnWidths.updated_at,
                    maxWidth: columnWidths.updated_at,
                  }}
                >
                  <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                    {formatDateTime(s.updated_at)}
                  </span>
                </TableCell>

                <TableCell
                  className="sticky right-0 z-10 border-l border-border/70 bg-card text-right"
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
                          aria-label={`Azioni per ${s.nome}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => router.push(`/scadenze/${s.id}`)}>
                        <ExternalLink data-icon="inline-start" />
                        Apri scadenza
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(s)}>
                        <Pencil data-icon="inline-start" />
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(s)}>
                        <Trash2 data-icon="inline-start" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              </ScadenzaRowContextMenu>
            )
          })
        )}
      </TableBody>
        </DataTableShell>
      </div>
    </>
  )
}
