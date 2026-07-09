"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, Trash2, Pencil } from "lucide-react"
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import type { InstallatoreSortKey, SortDir } from "@/lib/installatori/api-types"

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
              aria-label="Seleziona tutti"
            />
          </TableHead>
          {HEADERS.map((col) => (
            <TableHead
              key={col.id}
              className={cn(
                "overflow-hidden whitespace-nowrap border-r border-foreground/30 font-semibold text-muted-foreground",
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
          <TableHead className="sticky right-0 z-30 w-16 border-l border-foreground/30 bg-muted/95 text-right" />
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
            <TableRow
              key={i.id}
              data-state={selected.has(i.id) ? "selected" : undefined}
              className="group cursor-pointer"
              onClick={() => router.push(`/installatori/${i.id}`)}
            >
              <TableCell
                onClick={(e) => e.stopPropagation()}
                className="sticky left-0 z-10 border-r border-border/70 bg-card"
                style={{ width: 44, minWidth: 44, maxWidth: 44 }}
              >
                <Checkbox
                  checked={selected.has(i.id)}
                  onCheckedChange={() => onToggle(i.id)}
                  aria-label={`Seleziona ${i.nome}`}
                />
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{ width: COLUMN_WIDTH.nome, minWidth: COLUMN_WIDTH.nome, maxWidth: COLUMN_WIDTH.nome }}
              >
                <div className="flex items-center gap-2">
                  <InstallatoreAvatar nome={i.nome} />
                  <span className="truncate font-medium text-foreground">{i.nome}</span>
                </div>
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{ width: COLUMN_WIDTH.email, minWidth: COLUMN_WIDTH.email, maxWidth: COLUMN_WIDTH.email }}
              >
                <span className="truncate text-sm text-foreground">{i.email ?? "—"}</span>
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{ width: COLUMN_WIDTH.stato, minWidth: COLUMN_WIDTH.stato, maxWidth: COLUMN_WIDTH.stato }}
              >
                <Badge variant={i.attivo ? "secondary" : "outline"}>
                  {i.attivo ? "Attivo" : "Non attivo"}
                </Badge>
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{
                  width: COLUMN_WIDTH.proprietario_nome,
                  minWidth: COLUMN_WIDTH.proprietario_nome,
                  maxWidth: COLUMN_WIDTH.proprietario_nome,
                }}
              >
                <span className="whitespace-nowrap text-sm text-foreground">
                  {i.proprietario_nome ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{ width: COLUMN_WIDTH.tag, minWidth: COLUMN_WIDTH.tag, maxWidth: COLUMN_WIDTH.tag }}
              >
                {i.tag ? (
                  <span className="inline-flex max-w-full items-center rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">
                    <span className="truncate">{i.tag}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{
                  width: COLUMN_WIDTH.telefono,
                  minWidth: COLUMN_WIDTH.telefono,
                  maxWidth: COLUMN_WIDTH.telefono,
                }}
              >
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {i.telefono ?? "—"}
                </span>
              </TableCell>

              <TableCell
                className="border-r border-border/70"
                style={{
                  width: COLUMN_WIDTH.updated_at,
                  minWidth: COLUMN_WIDTH.updated_at,
                  maxWidth: COLUMN_WIDTH.updated_at,
                }}
              >
                <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                  {formatDate(i.updated_at)}
                </span>
              </TableCell>

              <TableCell
                onClick={(e) => e.stopPropagation()}
                className="sticky right-0 z-10 border-l border-border/70 bg-card text-right"
                style={{ width: 64, minWidth: 64, maxWidth: 64 }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
                        aria-label={`Azioni per ${i.nome}`}
                      >
                        <MoreHorizontal className="size-4" />
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
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </DataTableShell>
  )
}
