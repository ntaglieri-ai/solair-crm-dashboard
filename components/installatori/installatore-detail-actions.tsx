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
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import { InstallatoreFormDialog } from "./new-installatore-dialog"

/** Azioni modifica/elimina per l'header della scheda Installatore. */
export function InstallatoreDetailActions({
  installatore,
}: {
  installatore: InstallatoreRecord
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/installatori/${installatore.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Eliminazione non riuscita")
      toast.success("Installatore eliminato", { description: installatore.nome })
      router.push("/installatori")
      router.refresh()
    } catch {
      toast.error("Errore nell'eliminazione")
      setDeleting(false)
    }
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

      <InstallatoreFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        installatore={installatore}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina installatore</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare{" "}
              <span className="font-semibold text-foreground">
                {installatore.nome}
              </span>
              ? L&apos;azione non può essere annullata.
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
