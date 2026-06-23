"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, ExternalLink, Trash2 } from "lucide-react"
import { IconArrowUp } from "@tabler/icons-react"
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
  type InstallatoreRecord,
  type InstallatoreColumn,
  type InstallatoreColumnId,
} from "@/lib/mock-data"
import { InstallatoreCell } from "./installatore-cell"

export type SortDir = "asc" | "desc"
export type Density = "comoda" | "normale" | "densa"

const DENSITY_CELL: Record<Density, string> = {
  comoda: "py-4 text-sm",
  normale: "py-2.5 text-sm",
  densa: "py-1 text-xs",
}

// Nome Installatore, E-mail e Tag sono allineati a sinistra; il resto centrato.
function isLeftAligned(id: InstallatoreColumnId) {
  return id === "Nome Installatore" || id === "E-mail" || id === "Tag"
}

export function InstallatoreTable({
  installatori,
  columns,
  selected,
  onToggle,
  onToggleAll,
  onDelete,
  sortBy,
  sortDir,
  onSort,
  density = "normale",
}: {
  installatori: InstallatoreRecord[]
  columns: InstallatoreColumn[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDelete: (installatore: InstallatoreRecord) => void
  sortBy: InstallatoreColumnId | null
  sortDir: SortDir
  onSort: (col: InstallatoreColumnId) => void
  density?: Density
}) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const allSelected =
    installatori.length > 0 && installatori.every((i) => selected.has(i.id))
  const colSpan = columns.length + 2
  const cellPad = DENSITY_CELL[density]

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
            <TableHead className="sticky left-0 z-10 w-10 border-r border-foreground/30 bg-muted/95">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleziona tutti"
              />
            </TableHead>
            {columns.map((col) => {
              const left = isLeftAligned(col.id)
              const active = sortBy === col.id
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    "whitespace-nowrap border-r border-foreground/30",
                    left ? "text-left" : "text-center",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.id)}
                    className={cn(
                      "inline-flex w-full items-center gap-1 text-xs font-semibold transition-colors hover:text-foreground",
                      active ? "text-navy" : "text-muted-foreground",
                      left ? "justify-start" : "justify-center",
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
          {installatori.map((installatore) => (
            <TableRow
              key={installatore.id}
              onClick={() => router.push(`/installatori/${installatore.id}`)}
              className="cursor-pointer"
              data-state={
                selected.has(installatore.id) ? "selected" : undefined
              }
            >
              <TableCell
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "sticky left-0 z-10 border-r border-border/70 bg-card",
                  cellPad,
                )}
              >
                <Checkbox
                  checked={selected.has(installatore.id)}
                  onCheckedChange={() => onToggle(installatore.id)}
                  aria-label={`Seleziona ${installatore["Nome Installatore"]}`}
                />
              </TableCell>

              {columns.map((col) => {
                const left = isLeftAligned(col.id)
                return (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "whitespace-nowrap border-r border-border/70",
                      cellPad,
                      left ? "text-left" : "text-center",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center",
                        left ? "justify-start" : "justify-center",
                      )}
                    >
                      <InstallatoreCell
                        installatore={installatore}
                        column={col.id}
                        density={density}
                      />
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
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/installatori/${installatore.id}`)
                        }
                      >
                        <ExternalLink data-icon="inline-start" />
                        Apri
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
              </TableCell>
            </TableRow>
          ))}

          {installatori.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={colSpan}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                Nessun installatore corrisponde ai filtri selezionati.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}
