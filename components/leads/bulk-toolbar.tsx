"use client"

import {
  IconUserEdit,
  IconTag,
  IconDownload,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { mockCommerciali, STATO_LEAD_ORDER } from "@/lib/mock-data"

const ICON_BTN =
  "flex size-9 items-center justify-center rounded-lg text-navy transition-transform duration-150 hover:scale-110 hover:bg-secondary"

export function BulkToolbar({
  count,
  onChangeOwner,
  onChangeStato,
  onExport,
  onDelete,
  onClear,
}: {
  count: number
  onChangeOwner: (owner: string) => void
  onChangeStato: (stato: string) => void
  onExport: () => void
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
        <span className="px-2 text-sm font-medium text-foreground">
          <span className="font-bold tabular-nums text-navy">{count}</span>{" "}
          {count === 1 ? "lead selezionato" : "lead selezionati"}
        </span>

        <span className="mx-1 h-6 w-px bg-border" />

        {/* Cambia proprietario */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button type="button" aria-label="Cambia proprietario" className={ICON_BTN}>
                      <IconUserEdit size={18} stroke={1.8} />
                    </button>
                  }
                />
              }
            />
            <TooltipContent>Cambia proprietario</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" side="top" className="w-56">
            <DropdownMenuLabel>Assegna a</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {mockCommerciali.map((c) => (
                <DropdownMenuItem key={c} onClick={() => onChangeOwner(c)}>
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cambia stato */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button type="button" aria-label="Cambia stato" className={ICON_BTN}>
                      <IconTag size={18} stroke={1.8} />
                    </button>
                  }
                />
              }
            />
            <TooltipContent>Cambia stato</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" side="top" className="w-56">
            <DropdownMenuLabel>Imposta stato</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {STATO_LEAD_ORDER.map((s) => (
                <DropdownMenuItem key={s} onClick={() => onChangeStato(s)}>
                  {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Esporta CSV */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" aria-label="Esporta CSV" className={ICON_BTN} onClick={onExport}>
                <IconDownload size={18} stroke={1.8} />
              </button>
            }
          />
          <TooltipContent>Esporta CSV</TooltipContent>
        </Tooltip>

        {/* Elimina */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Elimina"
                className="flex size-9 items-center justify-center rounded-lg text-destructive transition-transform duration-150 hover:scale-110 hover:bg-destructive/10"
                onClick={onDelete}
              >
                <IconTrash size={18} stroke={1.8} />
              </button>
            }
          />
          <TooltipContent>Elimina</TooltipContent>
        </Tooltip>

        <span className="mx-1 h-6 w-px bg-border" />

        <Button
          size="icon"
          variant="ghost"
          aria-label="Deseleziona tutto"
          onClick={onClear}
          className="size-9"
        >
          <IconX size={18} stroke={1.8} />
        </Button>
      </div>
    </div>
  )
}
