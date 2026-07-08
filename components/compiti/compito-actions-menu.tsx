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
}: {
  selectedCount: number
  onBulkTransfer: (owner: CompitoProprietario) => void
  onBulkStato: (stato: StatoCompito) => void
  onBulkComplete: () => void
  onBulkDelete: () => void
}) {
  const hasSelection = selectedCount > 0
  const [transferOpen, setTransferOpen] = useState(false)
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
