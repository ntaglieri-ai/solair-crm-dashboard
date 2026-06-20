"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MoreHorizontal, ExternalLink, Trash2, Check } from "lucide-react"
import { IconArrowUp, IconNote, IconBellRinging } from "@tabler/icons-react"
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
import { type Compito, isCompitoScaduto } from "@/lib/mock-data"
import { StatoBadge, PrioritaBadge, CompitoAvatar } from "./compito-utils"

export type SortDir = "asc" | "desc"
export type CompitoSortKey =
  | "Oggetto"
  | "Stato"
  | "Priorità"
  | "Data di scadenza"
  | "Proprietario del compito"

const COLUMNS: { key: CompitoSortKey; label: string; sortable: boolean }[] = [
  { key: "Oggetto", label: "Oggetto", sortable: true },
  { key: "Proprietario del compito", label: "Proprietario", sortable: true },
  { key: "Data di scadenza", label: "Scadenza", sortable: true },
  { key: "Stato", label: "Stato", sortable: true },
  { key: "Priorità", label: "Priorità", sortable: true },
]

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const allSelected =
    compiti.length > 0 && compiti.every((c) => selected.has(c.id))

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
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "whitespace-nowrap font-semibold text-muted-foreground",
                  col.sortable && "cursor-pointer select-none",
                )}
                onClick={() => col.sortable && onSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
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
            <TableHead className="w-12 text-right" />
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => onToggle(c.id)}
                      aria-label={`Seleziona ${c.Oggetto}`}
                    />
                  </TableCell>

                  {/* Oggetto */}
                  <TableCell className="max-w-[360px]">
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
                    {c["Correlato a"] && (
                      <Link
                        href={
                          c["Correlato a"].tipo === "Lead"
                            ? `/leads/${c["Correlato a"].id}`
                            : `/clienti/${c["Correlato a"].id}`
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-info hover:underline"
                      >
                        {c["Correlato a"].nome}
                      </Link>
                    )}
                  </TableCell>

                  {/* Proprietario */}
                  <TableCell>
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

                  {/* Scadenza */}
                  <TableCell>
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
                  <TableCell>
                    <StatoBadge stato={c.Stato} />
                  </TableCell>

                  {/* Priorità */}
                  <TableCell>
                    <PrioritaBadge priorita={c.Priorità} />
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
      </Table>
    </div>
  )
}
