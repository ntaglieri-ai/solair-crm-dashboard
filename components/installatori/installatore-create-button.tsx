"use client"

import { Plus } from "lucide-react"
import {
  IconChevronDown,
  IconFileImport,
  IconNote,
  IconSparkles,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function InstallatoreCreateButton({
  onCreate,
  onImportInstallatori,
  onImportNota,
}: {
  onCreate: () => void
  onImportInstallatori: () => void
  onImportNota: () => void
}) {
  return (
    <div className="flex items-center">
      <Button
        className="rounded-r-none bg-teal text-teal-foreground hover:bg-teal/90"
        onClick={onCreate}
      >
        <Plus data-icon="inline-start" />
        Crea Installatore
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Altre opzioni di creazione"
              className="rounded-l-none border-l border-teal-foreground/20 bg-teal px-2 text-teal-foreground hover:bg-teal/90"
            >
              <IconChevronDown size={16} stroke={2} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onImportInstallatori}>
            <IconFileImport size={16} stroke={1.8} data-icon="inline-start" />
            Importa Installatori
            <IconSparkles size={14} className="ml-auto text-amber-500" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportNota}>
            <IconNote size={16} stroke={1.8} data-icon="inline-start" />
            Importa Nota
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
