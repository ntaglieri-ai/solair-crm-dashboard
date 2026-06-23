"use client"

import { useRouter } from "next/navigation"
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconClock,
  IconDots,
  IconMail,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type Scadenza, isScadenzaScaduta } from "@/lib/mock-data"
import { ScadutaBadge } from "./scadenza-utils"

export function ScadenzaDetailHeader({
  scadenza,
  onEdit,
  onDelete,
}: {
  scadenza: Scadenza
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const scaduta = isScadenzaScaduta(scadenza)

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <button
          onClick={() => router.push("/scadenze")}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft size={18} stroke={1.8} />
          Scadenze
        </button>
        <div className="flex items-center gap-2">
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90" size="sm">
            <IconMail size={15} stroke={1.8} data-icon="inline-start" />
            Invia e-mail
          </Button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <IconPencil size={15} stroke={1.8} />
            Modifica
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label="Altre azioni"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <IconDots size={16} stroke={1.8} />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>Clona</DropdownMenuItem>
              <DropdownMenuItem>Condividi</DropdownMenuItem>
              <DropdownMenuItem>Anteprima di stampa</DropdownMenuItem>
              <DropdownMenuItem>Trova e unisci duplicati</DropdownMenuItem>
              <DropdownMenuItem>Fusione e-mail</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
              >
                <IconTrash size={15} stroke={1.8} />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-5 pt-1 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy">
            <IconCalendarEvent size={24} stroke={1.8} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-pretty text-xl font-semibold leading-tight text-foreground">
                {scadenza["Nome Scadenze"]}
              </h1>
              {scaduta && <ScadutaBadge />}
            </div>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
            >
              <IconPlus size={13} stroke={2} />
              Aggiungi tag
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <IconClock size={15} stroke={1.8} />
                Scadenza {scadenza["Data scadenza"]}
              </span>
              <span>Proprietario {scadenza["Proprietario di Scadenze"]}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
