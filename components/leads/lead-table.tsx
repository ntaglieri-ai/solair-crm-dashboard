"use client"

import { Fragment, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { MoreHorizontal, ExternalLink, UserCheck, Trash2 } from "lucide-react"
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
  selected,
  onToggle,
  onToggleAll,
  onConvert,
  onDelete,
  sortBy,
  sortDir,
  onSort,
  density = "normale",
}: {
  leads: Lead[]
  columns: LeadColumn[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onConvert: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  sortBy: LeadColumnId | null
  sortDir: SortDir
  onSort: (col: LeadColumnId) => void
  density?: Density
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [stuck, setStuck] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const colSpan = columns.length + 3
  const cellPad = DENSITY_CELL[density]

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => setStuck(e.currentTarget.scrollTop > 0)}
      className="max-h-[calc(100vh-15rem)] overflow-auto rounded-xl border border-border bg-card"
    >
      <Table>
        <TableHeader
          className={cn(
            "sticky top-0 z-20 bg-muted/95 backdrop-blur transition-shadow duration-150",
            stuck && "shadow-[0_4px_8px_-4px_rgba(0,0,0,0.15)]",
          )}
        >
          <TableRow className="hover:bg-transparent">
            {/* Espansione */}
            <TableHead className="w-8 border-r border-border" />
            {/* Selezione */}
            <TableHead className="sticky left-0 z-10 w-10 border-r border-border bg-muted/95">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {columns.map((col) => {
              const numeric = NUMERIC_COLUMNS.includes(col.id)
              const active = sortBy === col.id
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    "whitespace-nowrap border-r border-border",
                    numeric && "text-right",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.id)}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-foreground",
                      active ? "text-navy" : "text-muted-foreground",
                      numeric && "flex-row-reverse",
                    )}
                  >
                    {col.label}
                    <IconArrowUp
                      size={14}
                      stroke={2}
                      className={cn(
                        "transition-all duration-150",
                        active
                          ? "text-navy opacity-100"
                          : "text-muted-foreground opacity-30",
                        active && sortDir === "desc" && "rotate-180",
                      )}
                    />
                  </button>
                </TableHead>
              )
            })}
            <TableHead className="w-10 text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const isOpen = expanded.has(lead.id)
            const leftAligned = (id: LeadColumnId) =>
              id === "Nome Lead" || id === "E-mail"
            return (
              <Fragment key={lead.id}>
                <TableRow
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="cursor-pointer"
                  data-state={selected.has(lead.id) ? "selected" : undefined}
                >
                  {/* Chevron espansione */}
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className={cn("w-8", cellPad)}
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
                    className={cn("sticky left-0 z-10 bg-card", cellPad)}
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
                          "whitespace-nowrap",
                          cellPad,
                          isLeft ? "text-left" : "text-center",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center",
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
                    className={cn("text-right", cellPad)}
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
                          <DropdownMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
                            <ExternalLink data-icon="inline-start" />
                            Apri
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onConvert(lead)}>
                            <UserCheck data-icon="inline-start" />
                            Converti a cliente
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead)}>
                            <Trash2 data-icon="inline-start" />
                            Elimina
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Riga espansa */}
                {isOpen ? (
                  <TableRow className="hover:bg-transparent">
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
                            <IconSpeakerphone size={15} stroke={1.8} className="mt-0.5 shrink-0 text-muted-foreground" />
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
                ) : null}
              </Fragment>
            )
          })}

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
      </Table>
    </div>
  )
}
