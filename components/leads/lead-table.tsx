"use client"

import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, UserCheck, Trash2, ArrowUpDown } from "lucide-react"
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
}) {
  const router = useRouter()
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const colSpan = columns.length + 2

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky left-0 z-10 w-10 border-r border-border bg-muted/50">
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
                      active ? "text-foreground" : "text-muted-foreground",
                      numeric && "flex-row-reverse",
                    )}
                  >
                    {col.label}
                    <ArrowUpDown
                      className={cn("size-3", active ? "opacity-100" : "opacity-40")}
                    />
                  </button>
                </TableHead>
              )
            })}
            <TableHead className="w-10 text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              onClick={() => router.push(`/leads/${lead.id}`)}
              className="cursor-pointer"
            >
              <TableCell
                onClick={(e) => e.stopPropagation()}
                className="sticky left-0 z-10 bg-card"
              >
                <Checkbox
                  checked={selected.has(lead.id)}
                  onCheckedChange={() => onToggle(lead.id)}
                  aria-label={`Seleziona ${lead["Nome Lead"]}`}
                />
              </TableCell>

              {columns.map((col) => {
                const leftAligned = col.id === "Nome Lead" || col.id === "E-mail"
                return (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "whitespace-nowrap text-sm",
                      leftAligned ? "text-left" : "text-center",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center",
                        leftAligned ? "justify-start" : "justify-center",
                      )}
                    >
                      <LeadCell lead={lead} column={col.id} />
                    </div>
                  </TableCell>
                )
              })}

              <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
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
          ))}

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
