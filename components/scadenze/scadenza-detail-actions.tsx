"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconPencil, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import { ScadenzaFormDialog } from "./scadenza-form-dialog"
import { useDeleteScadenza } from "@/lib/scadenze/hooks"

/** Azioni modifica/elimina per l'header della scheda Scadenza. */
export function ScadenzaDetailActions({
  scadenza,
}: {
  scadenza: ScadenzaRecord
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteScadenza = useDeleteScadenza()

  const handleDelete = () => {
    if (deleting) return
    setDeleting(true)
    deleteScadenza.mutate(scadenza.id, {
      onSuccess: () => {
        toast.success("Scadenza eliminata", { description: scadenza.nome })
        router.push("/scadenze")
      },
      onError: () => {
        toast.error("Errore nell'eliminazione")
        setDeleting(false)
      },
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <IconPencil size={15} stroke={1.8} data-icon="inline-start" />
        Modifica
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <IconTrash size={15} stroke={1.8} data-icon="inline-start" />
        Elimina
      </Button>

      <ScadenzaFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        scadenza={scadenza}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina scadenza</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">{scadenza.nome}</span>?
              L&apos;azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
