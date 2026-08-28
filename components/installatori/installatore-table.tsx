"use client"

import { useState } from "react"
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
          className="flex min-h-[82px] shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              checked={selected.has(installatore.id)}
              onCheckedChange={() => onToggle(installatore.id)}
              aria-label={`Seleziona ${installatore.nome}`}
            />
          </div>

          <InstallatoreAvatar nome={installatore.nome} size={36} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="truncate text-base font-bold text-foreground">
                {installatore.nome}
              </h3>
              <StatoPill tone={installatore.attivo ? "success" : "muted"}>
                {installatore.attivo ? "Attivo" : "Non attivo"}
              </StatoPill>
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <UserRound className="size-3.5 shrink-0" />
              <span className="truncate">
                {installatore.proprietario_nome ?? "Proprietario non assegnato"}
              </span>
              <span className="shrink-0 text-muted-foreground/50">·</span>
              <CalendarClock className="size-3.5 shrink-0" />
              <span className="truncate">{formatDate(installatore.updated_at)}</span>
            </div>

            <div className="mt-1 min-w-0 overflow-hidden">
              <InstallatoreTagBadges installatoreId={installatore.id} max={1} />
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-0.5"
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

const COLUMN_WIDTH: Record<string, number> = {
  nome: 240,
  email: 240,
  stato: 140,
  proprietario_nome: 210,
  tag: 180,
  telefono: 170,
  updated_at: 190,
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
  const colIds = ["nome", "email", "stato", "proprietario_nome", "tag", "telefono", "updated_at"]
  const tableWidth = 44 + colIds.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0) + 64

  const HEADERS: { id: string; label: string; sortKey: InstallatoreSortKey | null }[] = [
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
        {colIds.map((id) => (
          <col key={id} style={{ width: COLUMN_WIDTH[id] }} />
        ))}
        <col style={{ width: 64 }} />
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
                width: COLUMN_WIDTH[col.id],
                minWidth: COLUMN_WIDTH[col.id],
                maxWidth: COLUMN_WIDTH[col.id],
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
            className={cn(LIGHTNING.headCell, LIGHTNING.headLabel, "sticky right-0 z-30 w-16 text-right")}
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
                style={{ width: COLUMN_WIDTH.nome, minWidth: COLUMN_WIDTH.nome, maxWidth: COLUMN_WIDTH.nome }}
              >
                <div className="flex items-center gap-2">
                  <InstallatoreAvatar nome={i.nome} />
                  <span className="truncate font-medium text-foreground">{i.nome}</span>
                </div>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: COLUMN_WIDTH.email, minWidth: COLUMN_WIDTH.email, maxWidth: COLUMN_WIDTH.email }}
              >
                <span className="truncate text-foreground">{i.email ?? "—"}</span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: COLUMN_WIDTH.stato, minWidth: COLUMN_WIDTH.stato, maxWidth: COLUMN_WIDTH.stato }}
              >
                <StatoPill tone={i.attivo ? "success" : "muted"}>
                  {i.attivo ? "Attivo" : "Non attivo"}
                </StatoPill>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: COLUMN_WIDTH.proprietario_nome,
                  minWidth: COLUMN_WIDTH.proprietario_nome,
                  maxWidth: COLUMN_WIDTH.proprietario_nome,
                }}
              >
                <span className="whitespace-nowrap text-foreground">
                  {i.proprietario_nome ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{ width: COLUMN_WIDTH.tag, minWidth: COLUMN_WIDTH.tag, maxWidth: COLUMN_WIDTH.tag }}
              >
                <InstallatoreTagBadges installatoreId={i.id} max={2} />
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: COLUMN_WIDTH.telefono,
                  minWidth: COLUMN_WIDTH.telefono,
                  maxWidth: COLUMN_WIDTH.telefono,
                }}
              >
                <span className="whitespace-nowrap text-muted-foreground">
                  {i.telefono ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className={cn(LIGHTNING.cell, CELL_PAD)}
                style={{
                  width: COLUMN_WIDTH.updated_at,
                  minWidth: COLUMN_WIDTH.updated_at,
                  maxWidth: COLUMN_WIDTH.updated_at,
                }}
              >
                <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatDate(i.updated_at)}
                </span>
              </TableCell>

              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(LIGHTNING.cellSticky, LIGHTNING.cellActions, CELL_PAD)}
                style={{ width: 64, minWidth: 64, maxWidth: 64 }}
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
