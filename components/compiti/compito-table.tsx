"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MoreHorizontal, ExternalLink, Trash2, Check } from "lucide-react"
import { IconArrowUp, IconNote, IconBellRinging } from "@tabler/icons-react"
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
import { type Compito, isCompitoScaduto } from "@/lib/mock-data"
import { StatoBadge, PrioritaBadge, CompitoAvatar, correlatoHref } from "./compito-utils"

export type SortDir = "asc" | "desc"
export type CompitoSortKey =
  | "Oggetto"
  | "Stato"
  | "Priorità"
  | "Data di scadenza"
  | "Proprietario del compito"
  | "Nome contatto"
  | "Tag"

const COLUMNS: { key: CompitoSortKey; label: string; sortable: boolean }[] = [
  { key: "Oggetto", label: "Oggetto", sortable: true },
  { key: "Proprietario del compito", label: "Proprietario", sortable: true },
  { key: "Nome contatto", label: "Contatto", sortable: true },
  { key: "Tag", label: "Tag", sortable: true },
  { key: "Data di scadenza", label: "Scadenza", sortable: true },
  { key: "Stato", label: "Stato", sortable: true },
  { key: "Priorità", label: "Priorità", sortable: true },
]

const COLUMN_WIDTH: Record<CompitoSortKey, number> = {
  Oggetto: 360,
  "Proprietario del compito": 250,
  "Nome contatto": 240,
  Tag: 220,
  "Data di scadenza": 190,
  Stato: 170,
  Priorità: 150,
}

export function CompitoTable({
  compiti,
  selected,
  onToggle,
  onToggleAll,
  onComplete,
  onDelete,
  sortBy,
  sortDir,
  onSort,
}: {
  compiti: Compito[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onComplete: (c: Compito) => void
  onDelete: (c: Compito) => void
  sortBy: CompitoSortKey | null
  sortDir: SortDir
  onSort: (col: CompitoSortKey) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const allSelected =
    compiti.length > 0 && compiti.every((c) => selected.has(c.id))
  const tableWidth =
    44 + COLUMNS.reduce((sum, col) => sum + COLUMN_WIDTH[col.key], 0) + 64

  return (
    <DataTableShell
      ariaLabel="Tabella compiti"
      minTableWidth={tableWidth}
      alwaysShowVerticalScrollbar
      onScroll={(el) => setStuck(el.scrollTop > 0)}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        {COLUMNS.map((column) => (
          <col key={column.key} style={{ width: COLUMN_WIDTH[column.key] }} />
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
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "overflow-hidden whitespace-nowrap border-r border-foreground/30 font-semibold text-muted-foreground",
                  col.sortable && "cursor-pointer select-none",
                )}
                style={{
                  width: COLUMN_WIDTH[col.key],
                  minWidth: COLUMN_WIDTH[col.key],
                  maxWidth: COLUMN_WIDTH[col.key],
                }}
                onClick={() => col.sortable && onSort(col.key)}
              >
                <span className="inline-flex max-w-full items-center gap-1">
                  <span className="truncate">{col.label}</span>
                  {col.sortable && sortBy === col.key && (
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
          {compiti.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 2}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                Nessun compito trovato con i filtri correnti.
              </TableCell>
            </TableRow>
          ) : (
            compiti.map((c) => {
              const scaduto = isCompitoScaduto(c)
              const completato = c.Stato === "Completato"
              return (
                <TableRow
                  key={c.id}
                  data-state={selected.has(c.id) ? "selected" : undefined}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/compiti/${c.id}`)}
                >
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className="sticky left-0 z-10 border-r border-border/70 bg-card"
                    style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => onToggle(c.id)}
                      aria-label={`Seleziona ${c.Oggetto}`}
                    />
                  </TableCell>

                  {/* Oggetto */}
                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH.Oggetto,
                      minWidth: COLUMN_WIDTH.Oggetto,
                      maxWidth: COLUMN_WIDTH.Oggetto,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate font-medium text-foreground",
                          completato && "text-muted-foreground line-through",
                        )}
                      >
                        {c.Oggetto}
                      </span>
                      {c.Note.length > 0 && (
                        <IconNote
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                      {c.Promemoria && (
                        <IconBellRinging
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                    </div>
                    {c["Correlato a"] &&
                      (c["Correlato a"].linkable ? (
                        <Link
                          href={correlatoHref(c["Correlato a"])}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-info hover:underline"
                        >
                          {c["Correlato a"].nome}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {c["Correlato a"].nome}
                        </span>
                      ))}
                  </TableCell>

                  {/* Proprietario */}
                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH["Proprietario del compito"],
                      minWidth: COLUMN_WIDTH["Proprietario del compito"],
                      maxWidth: COLUMN_WIDTH["Proprietario del compito"],
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CompitoAvatar
                        nome={c["Proprietario del compito"]}
                        size={26}
                      />
                      <span className="whitespace-nowrap text-sm text-foreground">
                        {c["Proprietario del compito"]}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH["Nome contatto"],
                      minWidth: COLUMN_WIDTH["Nome contatto"],
                      maxWidth: COLUMN_WIDTH["Nome contatto"],
                    }}
                  >
                    <span className="block truncate text-sm font-medium text-foreground">
                      {c["Nome contatto"] || "—"}
                    </span>
                  </TableCell>

                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH.Tag,
                      minWidth: COLUMN_WIDTH.Tag,
                      maxWidth: COLUMN_WIDTH.Tag,
                    }}
                  >
                    {c.Tag ? (
                      <span className="inline-flex max-w-full items-center rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal">
                        <span className="truncate">{c.Tag}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Scadenza */}
                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH["Data di scadenza"],
                      minWidth: COLUMN_WIDTH["Data di scadenza"],
                      maxWidth: COLUMN_WIDTH["Data di scadenza"],
                    }}
                  >
                    <span
                      className={cn(
                        "whitespace-nowrap text-sm tabular-nums",
                        scaduto
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {c["Data di scadenza"]}
                    </span>
                  </TableCell>

                  {/* Stato */}
                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH.Stato,
                      minWidth: COLUMN_WIDTH.Stato,
                      maxWidth: COLUMN_WIDTH.Stato,
                    }}
                  >
                    <StatoBadge stato={c.Stato} />
                  </TableCell>

                  {/* Priorità */}
                  <TableCell
                    className="border-r border-border/70"
                    style={{
                      width: COLUMN_WIDTH.Priorità,
                      minWidth: COLUMN_WIDTH.Priorità,
                      maxWidth: COLUMN_WIDTH.Priorità,
                    }}
                  >
                    <PrioritaBadge priorita={c.Priorità} />
                  </TableCell>

                  {/* Azioni */}
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
                            aria-label={`Azioni per ${c.Oggetto}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/compiti/${c.id}`)}
                        >
                          <ExternalLink data-icon="inline-start" />
                          Apri compito
                        </DropdownMenuItem>
                        {!completato && (
                          <DropdownMenuItem onClick={() => onComplete(c)}>
                            <Check data-icon="inline-start" />
                            Segna come completato
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(c)}
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
