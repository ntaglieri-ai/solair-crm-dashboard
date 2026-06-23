"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, Trash2, Pencil } from "lucide-react"
import { IconArrowUp, IconNote, IconPaperclip } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  Table,
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Scadenza, isScadenzaScaduta } from "@/lib/mock-data"
import { ScadutaBadge, ScadenzaAvatar } from "./scadenza-utils"

export type SortDir = "asc" | "desc"
export type ScadenzaSortKey =
  | "Nome Scadenze"
  | "Data scadenza"
  | "Proprietario di Scadenze"
  | "Ora modifica"

const COLUMNS: { key: ScadenzaSortKey; label: string }[] = [
  { key: "Nome Scadenze", label: "Nome Scadenze" },
  { key: "Data scadenza", label: "Data scadenza" },
  { key: "Proprietario di Scadenze", label: "Proprietario di Scadenze" },
  { key: "Ora modifica", label: "Ora modifica" },
]

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
  scadenze: Scadenza[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onEdit: (s: Scadenza) => void
  onDelete: (s: Scadenza) => void
  sortBy: ScadenzaSortKey | null
  sortDir: SortDir
  onSort: (col: ScadenzaSortKey) => void
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const allSelected =
    scadenze.length > 0 && scadenze.every((s) => selected.has(s.id))

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setStuck(e.currentTarget.scrollTop > 0)}
      className="max-h-[calc(100vh-16rem)] overflow-auto rounded-xl border border-border bg-card"
    >
      <Table>
        <TableHeader
          className={cn(
            "sticky top-0 z-20 bg-muted/95 backdrop-blur transition-shadow duration-150",
            stuck && "shadow-[0_4px_8px_-4px_rgba(0,0,0,0.15)]",
          )}
        >
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutte"
              />
            </TableHead>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className="cursor-pointer select-none whitespace-nowrap font-semibold text-muted-foreground"
                onClick={() => onSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key && (
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
            <TableHead className="w-12 text-right" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {scadenze.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={COLUMNS.length + 2}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                Nessuna scadenza trovata con i filtri correnti.
              </TableCell>
            </TableRow>
          ) : (
            scadenze.map((s) => {
              const scaduta = isScadenzaScaduta(s)
              return (
                <TableRow
                  key={s.id}
                  data-state={selected.has(s.id) ? "selected" : undefined}
                  className="group cursor-pointer"
                  onClick={() => router.push(`/scadenze/${s.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => onToggle(s.id)}
                      aria-label={`Seleziona ${s["Nome Scadenze"]}`}
                    />
                  </TableCell>

                  {/* Nome Scadenze */}
                  <TableCell className="max-w-[360px]">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-info hover:underline">
                        {s["Nome Scadenze"]}
                      </span>
                      {s.Note.length > 0 && (
                        <IconNote
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                      {s["Caricamento file 1"] && (
                        <IconPaperclip
                          size={14}
                          stroke={1.8}
                          className="shrink-0 text-muted-foreground"
                        />
                      )}
                    </div>
                    {s["Connesso a"] && (
                      <span className="text-xs text-muted-foreground">
                        {s["Connesso a"]}
                      </span>
                    )}
                  </TableCell>

                  {/* Data scadenza */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "whitespace-nowrap text-sm tabular-nums",
                          scaduta
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {s["Data scadenza"]}
                      </span>
                      {scaduta && <ScadutaBadge />}
                    </div>
                  </TableCell>

                  {/* Proprietario */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ScadenzaAvatar
                        nome={s["Proprietario di Scadenze"]}
                        size={26}
                      />
                      <span className="whitespace-nowrap text-sm text-foreground">
                        {s["Proprietario di Scadenze"]}
                      </span>
                    </div>
                  </TableCell>

                  {/* Ora modifica */}
                  <TableCell>
                    <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                      {s["Ora modifica"]}
                    </span>
                  </TableCell>

                  {/* Azioni */}
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
                            aria-label={`Azioni per ${s["Nome Scadenze"]}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => router.push(`/scadenze/${s.id}`)}
                        >
                          <ExternalLink data-icon="inline-start" />
                          Apri scadenza
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(s)}>
                          <Pencil data-icon="inline-start" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(s)}
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
      </Table>
    </div>
  )
}
