"use client"

import { useState } from "react"
import { IconDotsVertical, IconArrowsExchange, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useScadenzeReferenceData } from "@/lib/scadenze/hooks"
import type { ScadenzaProprietario } from "@/lib/scadenze/hooks"

export function ScadenzaActionsMenu({
  selectedCount,
  onBulkTransfer,
  onBulkDelete,
}: {
  selectedCount: number
  onBulkTransfer: (owner: ScadenzaProprietario) => void
  onBulkDelete: () => void
}) {
  const hasSelection = selectedCount > 0
  const [transferOpen, setTransferOpen] = useState(false)
  const { data: referenceData } = useScadenzeReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const [ownerId, setOwnerId] = useState("")
  const selectedOwner = proprietari.find((p) => p.id === ownerId) ?? proprietari[0] ?? null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label="Azioni" className="relative bg-card">
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
                <DropdownMenuLabel>{selectedCount} selezionate</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                  <IconArrowsExchange size={16} stroke={1.8} data-icon="inline-start" />
                  Trasferimento di massa
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
                Seleziona una o più scadenze per abilitare le azioni di massa.
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
              Assegna le {selectedCount} scadenze selezionate a un nuovo proprietario.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-1">
            <Label>Nuovo proprietario</Label>
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
