"use client"

import { useState } from "react"
import {
  IconDotsVertical,
  IconArrowsExchange,
  IconCircleCheck,
  IconProgress,
  IconTrash,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockProprietariCompito,
  STATO_COMPITO_ORDER,
  type StatoCompito,
} from "@/lib/mock-data"

export function CompitoActionsMenu({
  selectedCount,
  onBulkTransfer,
  onBulkStato,
  onBulkComplete,
  onBulkDelete,
}: {
  selectedCount: number
  onBulkTransfer: (owner: string) => void
  onBulkStato: (stato: StatoCompito) => void
  onBulkComplete: () => void
  onBulkDelete: () => void
}) {
  const hasSelection = selectedCount > 0
  const [transferOpen, setTransferOpen] = useState(false)
  const [owner, setOwner] = useState(mockProprietariCompito[0])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Azioni"
              className="relative bg-card"
            >
              <IconDotsVertical size={18} stroke={1.8} />
              {hasSelection ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] font-bold leading-none text-navy-foreground tabular-nums">
                  {selectedCount}
                </span>
              ) : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-60">
          {hasSelection ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {selectedCount} selezionati
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                  <IconArrowsExchange size={16} stroke={1.8} data-icon="inline-start" />
                  Trasferimento di massa
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <IconProgress size={16} stroke={1.8} data-icon="inline-start" />
                    Cambia stato
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    {STATO_COMPITO_ORDER.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => onBulkStato(s)}>
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={onBulkComplete}>
                  <IconCircleCheck size={16} stroke={1.8} data-icon="inline-start" />
                  Segna come completati
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={onBulkDelete}>
                  <IconTrash size={16} stroke={1.8} data-icon="inline-start" />
                  Eliminazione di massa
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : (
            <DropdownMenuGroup>
              <DropdownMenuLabel>Azioni di massa</DropdownMenuLabel>
              <DropdownMenuItem disabled>
                Seleziona uno o più compiti per abilitare le azioni di massa.
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trasferimento di massa</DialogTitle>
            <DialogDescription>
              Assegna i {selectedCount} compiti selezionati a un nuovo
              proprietario.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label>Nuovo proprietario del compito</Label>
            <Select value={owner} onValueChange={(v) => setOwner(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockProprietariCompito.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                onBulkTransfer(owner)
                setTransferOpen(false)
              }}
            >
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
