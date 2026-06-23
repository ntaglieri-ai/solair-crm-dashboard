"use client"

import { toast } from "sonner"
import { MoreHorizontal, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ScadenzaActionsMenu({
  selectedCount,
  onBulkDelete,
}: {
  selectedCount: number
  onBulkDelete: () => void
}) {
  const has = selectedCount > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Azioni di massa" className="bg-card">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          {has ? `${selectedCount} selezionate` : "Azioni di massa"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            toast.success("Esportazione avviata", {
              description: has
                ? `${selectedCount} scadenze in esportazione.`
                : "Esportazione di tutte le scadenze.",
            })
          }
        >
          <Download data-icon="inline-start" />
          Esporta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!has}
          onClick={onBulkDelete}
        >
          <Trash2 data-icon="inline-start" />
          Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
