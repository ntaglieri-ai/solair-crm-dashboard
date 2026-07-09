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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import type { ScadenzaSortKey, SortDir } from "@/lib/scadenze/api-types"
import { ScadutaBadge, ScadenzaAvatar } from "./scadenza-utils"

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

const COLUMN_WIDTH: Record<string, number> = {
  nome: 320,
  proprietario_nome: 220,
  tag: 180,
  collegamento: 150,
  data_scadenza: 210,
  updated_at: 210,
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
  // "Tag" condivide la key data_scadenza sopra solo per la larghezza colonna;
  // qui usiamo id univoci per colgroup/celle.
  const colIds = ["nome", "proprietario_nome", "tag", "collegamento", "data_scadenza", "updated_at"]
  const tableWidth =
    44 + colIds.reduce((sum, id) => sum + COLUMN_WIDTH[id], 0) + 64

  return (
    <DataTableShell
      ariaLabel="Tabella scadenze"
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
              aria-label="Seleziona tutte"
            />
          </TableHead>
          {[
            { id: "nome", label: "Nome", sortKey: "nome" as ScadenzaSortKey },
            { id: "proprietario_nome", label: "Proprietario", sortKey: "proprietario_nome" as ScadenzaSortKey },
            { id: "tag", label: "Tag", sortKey: null },
            { id: "collegamento", label: "Collegamento", sortKey: null },
            { id: "data_scadenza", label: "Data scadenza", sortKey: "data_scadenza" as ScadenzaSortKey },
            { id: "updated_at", label: "Aggiornata", sortKey: "updated_at" as ScadenzaSortKey },
          ].map((col) => (
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
                    aria-label={`Seleziona ${s.nome}`}
                  />
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{ width: COLUMN_WIDTH.nome, minWidth: COLUMN_WIDTH.nome, maxWidth: COLUMN_WIDTH.nome }}
                >
                  <span className="truncate font-medium text-foreground">{s.nome}</span>
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: COLUMN_WIDTH.proprietario_nome,
                    minWidth: COLUMN_WIDTH.proprietario_nome,
                    maxWidth: COLUMN_WIDTH.proprietario_nome,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ScadenzaAvatar nome={s.proprietario_nome ?? "—"} size={26} />
                    <span className="whitespace-nowrap text-sm text-foreground">
                      {s.proprietario_nome ?? "—"}
                    </span>
                  </div>
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{ width: COLUMN_WIDTH.tag, minWidth: COLUMN_WIDTH.tag, maxWidth: COLUMN_WIDTH.tag }}
                >
                  {s.tag ? (
                    <span className="inline-flex max-w-full items-center rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">
                      <span className="truncate">{s.tag}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell
                  className="border-r border-border/70"
                  style={{
                    width: COLUMN_WIDTH.collegamento,
                    minWidth: COLUMN_WIDTH.collegamento,
                    maxWidth: COLUMN_WIDTH.collegamento,
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
                    width: COLUMN_WIDTH.data_scadenza,
                    minWidth: COLUMN_WIDTH.data_scadenza,
                    maxWidth: COLUMN_WIDTH.data_scadenza,
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
                    width: COLUMN_WIDTH.updated_at,
                    minWidth: COLUMN_WIDTH.updated_at,
                    maxWidth: COLUMN_WIDTH.updated_at,
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
            )
          })
        )}
      </TableBody>
    </DataTableShell>
  )
}
