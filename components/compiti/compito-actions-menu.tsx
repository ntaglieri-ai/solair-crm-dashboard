"use client"

import { useState } from "react"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"
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
import { STATO_COMPITO_ORDER, type StatoCompito } from "@/lib/mock-data"
import {
  useCompitiReferenceData,
  type CompitoProprietario,
} from "@/lib/compiti/hooks"

export function CompitoActionsMenu({
  selectedCount,
  onBulkTransfer,
  onBulkStato,
  onBulkComplete,
  onBulkDelete,
  triggerClassName,
}: {
  selectedCount: number
  onBulkTransfer: (owner: CompitoProprietario) => void
  onBulkStato: (stato: StatoCompito) => void
  onBulkComplete: () => void
  onBulkDelete: () => void
  /** Classi extra per il bottone trigger (es. per ingrandirlo su mobile). */
  triggerClassName?: string
}) {
  const hasSelection = selectedCount > 0
  const [transferOpen, setTransferOpen] = useState(false)
  const permissions = usePermissions()
  const { data: referenceData } = useCompitiReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const [ownerId, setOwnerId] = useState("")
  const selectedOwner =
    proprietari.find((p) => p.id === ownerId) ?? proprietari[0] ?? null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Azioni"
              className={cn("relative h-11 w-full gap-1.5 bg-card px-2 text-xs lg:h-10 lg:w-10 lg:p-0 lg:text-sm", triggerClassName)}
            >
              <IconDotsVertical size={20} stroke={1.8} className="lg:size-[18px]" />
              <span className="lg:hidden">Azioni</span>
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
              {permissions.canRecord("compiti", "delete") ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" onClick={onBulkDelete}>
                      <IconTrash size={16} stroke={1.8} data-icon="inline-start" />
                      Eliminazione di massa
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : null}
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
            <Select
              items={Object.fromEntries(proprietari.map((p) => [p.id, p.nome]))}
              value={selectedOwner?.id ?? ""}
              onValueChange={(v) => setOwnerId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona proprietario" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {proprietari.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
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
              disabled={!selectedOwner}
              onClick={() => {
                if (!selectedOwner) return
                onBulkTransfer(selectedOwner)
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
