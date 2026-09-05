"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, ExternalLink, Mail, MoreHorizontal, Pencil, Phone, Trash2, UserRound } from "lucide-react"
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
import {
  LIGHTNING,
  LIGHTNING_DENSITY,
  RowInlineActions,
  StatoPill,
} from "@/components/shared/lightning-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import type { InstallatoreSortKey, SortDir } from "@/lib/installatori/api-types"
import { InstallatoreTagBadges } from "./installatore-tag-controls"
import { InstallatoreRowContextMenu } from "./installatore-row-context-menu"
import { estimateColumnWidth } from "@/lib/shared/table-column-widths"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value))
}

function initials(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function InstallatoreAvatar({ nome, size = 26 }: { nome: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(nome)}
    </span>
  )
}

function InstallatoreMobileList({
  installatori,
  selected,
  onToggle,
  onEdit,
  onDelete,
}: {
  installatori: InstallatoreRecord[]
  selected: Set<string>
  onToggle: (id: string) => void
  onEdit: (installatore: InstallatoreRecord) => void
  onDelete: (installatore: InstallatoreRecord) => void
}) {
  const router = useRouter()

  if (installatori.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        Nessun installatore trovato con i filtri correnti.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
      {installatori.map((installatore) => (
        <article
          key={installatore.id}
          role="button"
          tabIndex={0}
          className="grid min-h-[106px] shrink-0 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => {
            startNavigationFeedback()
            router.push(`/installatori/${installatore.id}`)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            startNavigationFeedback()
            router.push(`/installatori/${installatore.id}`)
          }}
        >
          <div className="mt-1.5 shrink-0" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={selected.has(installatore.id)}
              onCheckedChange={() => onToggle(installatore.id)}
              aria-label={`Seleziona ${installatore.nome}`}
            />
          </div>

          <span className="mt-0.5">
            <InstallatoreAvatar nome={installatore.nome} size={36} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
              <h3 className="min-w-0 flex-1 break-words text-base font-bold leading-tight text-foreground">
                {installatore.nome}
              </h3>
              <StatoPill tone={installatore.attivo ? "success" : "muted"}>
                {installatore.attivo ? "Attivo" : "Non attivo"}
              </StatoPill>
            </div>

            <div className="mt-1 grid min-w-0 gap-1 text-sm text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">
                  {installatore.proprietario_nome ?? "Proprietario non assegnato"}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <CalendarClock className="size-3.5 shrink-0" />
                <span className="truncate">{formatDate(installatore.updated_at)}</span>
              </span>
            </div>

            <div className="mt-1 min-w-0 overflow-hidden">
              <InstallatoreTagBadges installatoreId={installatore.id} max={1} />
            </div>
          </div>

          <div
            className="col-start-3 flex min-w-0 items-center justify-end gap-0.5"
            onClick={(event) => event.stopPropagation()}
          >
            {installatore.telefono ? (
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={<a href={`tel:${installatore.telefono.replace(/[^\d+]/g, "")}`} />}
                aria-label={`Chiama ${installatore.nome}`}
              >
                <Phone className="size-4" />
              </Button>
            ) : null}
            {installatore.email ? (
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={<a href={`mailto:${installatore.email}`} />}
                aria-label={`Scrivi a ${installatore.nome}`}
              >
                <Mail className="size-4" />
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Azioni per ${installatore.nome}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.push(`/installatori/${installatore.id}`)}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Apri installatore
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(installatore)}>
                    <Pencil data-icon="inline-start" />
                    Modifica
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(installatore)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </article>
      ))}
    </div>
  )
}

// Questa tabella non ha il selettore di densita' di Lead/Clienti: usa la
// densita' di default, cosi' le tre restano visivamente allineate.
const CELL_PAD = LIGHTNING_DENSITY.normale

const INSTALLATORE_COLUMN_IDS = [
  "nome",
  "email",
  "stato",
  "proprietario_nome",
  "tag",
  "telefono",
  "updated_at",
] as const

type InstallatoreColumnId = (typeof INSTALLATORE_COLUMN_IDS)[number]

const COLUMN_WIDTH_BOUNDS: Record<InstallatoreColumnId, { min: number; max: number }> = {
  nome: { min: 240, max: 460 },
  email: { min: 220, max: 420 },
  stato: { min: 140, max: 180 },
  proprietario_nome: { min: 190, max: 360 },
  tag: { min: 200, max: 420 },
  telefono: { min: 160, max: 260 },
  updated_at: { min: 180, max: 220 },
}

function installatoreColumnValue(i: InstallatoreRecord, column: InstallatoreColumnId) {
  if (column === "stato") return i.attivo ? "Attivo" : "Non attivo"
  if (column === "updated_at") return formatDate(i.updated_at)
  return i[column] ?? "—"
}

export function InstallatoreTable({
  installatori,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  sortBy,
  sortDir,
  onSort,
}: {
  installatori: InstallatoreRecord[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onEdit: (installatore: InstallatoreRecord) => void
  onDelete: (installatore: InstallatoreRecord) => void
  sortBy: InstallatoreSortKey | null
  sortDir: SortDir
  onSort: (col: InstallatoreSortKey) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const allSelected =
    installatori.length > 0 && installatori.every((i) => selected.has(i.id))
  const columnWidths = useMemo(() => {
    const widths = {} as Record<InstallatoreColumnId, number>
    for (const column of INSTALLATORE_COLUMN_IDS) {
      const bounds = COLUMN_WIDTH_BOUNDS[column]
      widths[column] = estimateColumnWidth({
        label: column === "proprietario_nome" ? "Proprietario" : column,
        values: installatori.map((i) => installatoreColumnValue(i, column)),
        min: bounds.min,
        max: bounds.max,
        padding: column === "tag" ? 76 : 46,
      })
    }
    return widths
  }, [installatori])
  const tableWidth =
    44 + INSTALLATORE_COLUMN_IDS.reduce((sum, id) => sum + columnWidths[id], 0) + 84

  const HEADERS: { id: InstallatoreColumnId; label: string; sortKey: InstallatoreSortKey | null }[] = [
    { id: "nome", label: "Nome", sortKey: "nome" },
    { id: "email", label: "E-mail", sortKey: "email" },
    { id: "stato", label: "Stato", sortKey: null },
    { id: "proprietario_nome", label: "Proprietario", sortKey: null },
    { id: "tag", label: "Tag", sortKey: null },
    { id: "telefono", label: "Telefono", sortKey: null },
    { id: "updated_at", label: "Aggiornato", sortKey: "updated_at" },
  ]

  return (
    <>
      <div className="lg:hidden">
        <InstallatoreMobileList
          installatori={installatori}
          selected={selected}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      <div className="hidden lg:block">
        <DataTableShell
      ariaLabel="Tabella installatori"
      minTableWidth={tableWidth}
      alwaysShowVerticalScrollbar
      onScroll={(el) => setStuck(el.scrollTop > 0)}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        {INSTALLATORE_COLUMN_IDS.map((id) => (
          <col key={id} style={{ width: columnWidths[id] }} />
        ))}
        <col style={{ width: 84 }} />
      </colgroup>
      <TableHeader className={cn(LIGHTNING.header, stuck && LIGHTNING.headerStuck)}>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(LIGHTNING.headCell, "sticky left-0 z-30 w-11")}>
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              aria-label="Seleziona tutti"
            />
          </TableHead>
          {HEADERS.map((col) => (
            <TableHead
              key={col.id}
              className={cn(
                LIGHTNING.headCell,
                LIGHTNING.headLabel,
                "overflow-hidden whitespace-nowrap",
                sortBy === col.sortKey ? LIGHTNING.headLabelActive : LIGHTNING.headLabelIdle,
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
          <TableHead
            className={cn(LIGHTNING.headCell, LIGHTNING.headLabel, LIGHTNING.headActions)}
            style={{ width: 84, minWidth: 84, maxWidth: 84 }}
          >
            Azioni
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {installatori.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
              Nessun installatore trovato con i filtri correnti.
            </TableCell>
          </TableRow>
        ) : (
          installatori.map((i) => (
            <InstallatoreRowContextMenu key={i.id} installatore={i} onEdit={onEdit} onDelete={onDelete}>
            <TableRow
              data-state={selected.has(i.id) ? "selected" : undefined}
              className={LIGHTNING.row}
              onClick={() => router.push(`/installatori/${i.id}`)}
            >
              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(LIGHTNING.cell, LIGHTNING.cellSticky, LIGHTNING.cellLeader, CELL_PAD)}
                style={{ width: 44, minWidth: 44, maxWidth: 44 }}
              >
                <Checkbox
                  checked={selected.has(i.id)}
                  onCheckedChange={() => onToggle(i.id)}
                  aria-label={`Seleziona ${i.nome}`}
                />
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: columnWidths.nome, minWidth: columnWidths.nome, maxWidth: columnWidths.nome }}
              >
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  <InstallatoreAvatar nome={i.nome} />
                  <span className="min-w-0 truncate font-medium text-foreground">{i.nome}</span>
                </div>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: columnWidths.email, minWidth: columnWidths.email, maxWidth: columnWidths.email }}
              >
                <span className="block min-w-0 truncate text-foreground">{i.email ?? "—"}</span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: columnWidths.stato, minWidth: columnWidths.stato, maxWidth: columnWidths.stato }}
              >
                <StatoPill tone={i.attivo ? "success" : "muted"}>
                  {i.attivo ? "Attivo" : "Non attivo"}
                </StatoPill>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: columnWidths.proprietario_nome,
                  minWidth: columnWidths.proprietario_nome,
                  maxWidth: columnWidths.proprietario_nome,
                }}
              >
                <span className="block min-w-0 truncate text-foreground">
                  {i.proprietario_nome ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: columnWidths.tag, minWidth: columnWidths.tag, maxWidth: columnWidths.tag }}
              >
                <InstallatoreTagBadges installatoreId={i.id} max={2} />
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: columnWidths.telefono,
                  minWidth: columnWidths.telefono,
                  maxWidth: columnWidths.telefono,
                }}
              >
                <span className="block min-w-0 truncate text-muted-foreground">
                  {i.telefono ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: columnWidths.updated_at,
                  minWidth: columnWidths.updated_at,
                  maxWidth: columnWidths.updated_at,
                }}
              >
                <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatDate(i.updated_at)}
                </span>
              </TableCell>

              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(LIGHTNING.cellActions, CELL_PAD)}
                style={{ width: 84, minWidth: 84, maxWidth: 84 }}
              >
                <RowInlineActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifica ${i.nome}`}
                    onClick={() => onEdit(i)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Azioni per ${i.nome}`}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => router.push(`/installatori/${i.id}`)}>
                          <ExternalLink data-icon="inline-start" />
                          Apri installatore
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(i)}>
                          <Pencil data-icon="inline-start" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(i)}>
                          <Trash2 data-icon="inline-start" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </RowInlineActions>
              </TableCell>
            </TableRow>
            </InstallatoreRowContextMenu>
          ))
        )}
      </TableBody>
        </DataTableShell>
      </div>
    </>
  )
}
