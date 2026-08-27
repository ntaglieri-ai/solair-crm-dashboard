"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  COLORE_FALLBACK,
  slugCategoria,
  type CategoriaCalendario,
} from "@/lib/calendario/types"

/**
 * Voce in modifica. `id` vuoto = categoria nuova: lo slug lo assegna il
 * server al salvataggio. Per le esistenti l'id viaggia invariato, perche'
 * e' il valore gia' scritto in eventi_calendario.categoria_id.
 */
type Riga = CategoriaCalendario & { nuova?: boolean }

export function CategorieDialog({
  open,
  onOpenChange,
  categorie,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorie: CategoriaCalendario[]
  onSaved: (categorie: CategoriaCalendario[]) => void
}) {
  const [righe, setRighe] = useState<Riga[]>([])
  const [saving, setSaving] = useState(false)

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) setRighe(categorie.map((c) => ({ ...c })))
    wasOpen.current = open
  }, [open, categorie])

  const aggiorna = (indice: number, patch: Partial<Riga>) => {
    setRighe((prev) => prev.map((riga, i) => (i === indice ? { ...riga, ...patch } : riga)))
  }

  const aggiungi = () => {
    setRighe((prev) => [
      ...prev,
      { id: "", nome: "", colore: COLORE_FALLBACK, nuova: true },
    ])
  }

  const rimuovi = (indice: number) => {
    setRighe((prev) => prev.filter((_, i) => i !== indice))
  }

  const valide = righe.filter((riga) => riga.nome.trim() !== "")

  const salva = async () => {
    if (saving) return
    if (valide.length === 0) {
      toast.error("Serve almeno una categoria")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/calendario/categorie", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorie: valide.map((riga) => ({
            id: riga.id || slugCategoria(riga.nome),
            nome: riga.nome.trim(),
            colore: riga.colore,
          })),
        }),
      })
      if (!res.ok) {
        const errore = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errore?.error ?? "Salvataggio non riuscito")
      }
      const payload = (await res.json()) as { categorie: CategoriaCalendario[] }
      onSaved(payload.categorie)
      toast.success("Categorie aggiornate")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nel salvataggio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorie del calendario</DialogTitle>
          <DialogDescription>
            Nome e colore di default. Gli eventi che non hanno un colore proprio
            seguono quello della loro categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {righe.map((riga, indice) => (
            <div key={riga.id || `nuova-${indice}`} className="flex items-center gap-2">
              <input
                type="color"
                value={riga.colore}
                onChange={(e) => aggiorna(indice, { colore: e.target.value.toLowerCase() })}
                className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                aria-label={`Colore di ${riga.nome || "nuova categoria"}`}
              />
              <Input
                value={riga.nome}
                onChange={(e) => aggiorna(indice, { nome: e.target.value })}
                placeholder="Nome categoria"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                aria-label={`Rimuovi ${riga.nome || "categoria"}`}
                onClick={() => rimuovi(indice)}
              >
                <IconTrash size={15} />
              </Button>
            </div>
          ))}

          <Button variant="ghost" size="sm" className="self-start" onClick={aggiungi}>
            <IconPlus size={15} data-icon="inline-start" />
            Aggiungi categoria
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Rimuovere una categoria non cancella gli eventi che la usano: restano nel
          calendario con un colore neutro, e si possono riassegnare a mano.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button disabled={saving || valide.length === 0} onClick={salva}>
            Salva categorie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
