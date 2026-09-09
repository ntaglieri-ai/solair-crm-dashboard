"use client"

import { useState } from "react"
import { toast } from "sonner"
import { IconPencil, IconTrash, IconCheck, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { RichNoteComposer } from "@/components/shared/rich-note"
import { usePermissions } from "@/lib/permissions/provider"
import type { NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"

/**
 * Comandi di modifica e cancellazione di una nota.
 *
 * Le liste di note dei quattro moduli hanno resa diversa ma stessi comandi:
 * tenerli qui evita quattro copie che si correggono una alla volta.
 *
 * Chi puo' usarli lo decide il permesso `note.gestione`, concesso a
 * Superadmin e Amministratori: chi non ce l'ha non vede i pulsanti, e le
 * route rispondono comunque 404.
 */
export function NotaAzioni({
  noteId,
  basePath,
  testo,
  menzioni,
  onModificata,
  onEliminata,
}: {
  noteId: string
  /** Base delle route del modulo, es. "/api/clienti/<id>/notes". */
  basePath: string
  testo: string
  menzioni?: NoteMention[]
  onModificata: (testo: string, menzioni: NoteMention[]) => void
  onEliminata: () => void
}) {
  const permissions = usePermissions()
  const [modifica, setModifica] = useState(false)
  const [bozza, setBozza] = useState(testo)
  const [bozzaMenzioni, setBozzaMenzioni] = useState<NoteMentionDraft[]>(menzioni ?? [])
  // Il compositore accetta allegati, ma in modifica non se ne aggiungono:
  // quelli della nota restano quelli caricati alla creazione.
  const [allegati, setAllegati] = useState<File[]>([])
  const [inCorso, setInCorso] = useState(false)

  if (!permissions.canAction("note.gestione")) return null

  async function salva() {
    if (!bozza.trim()) return
    setInCorso(true)
    try {
      const formData = new FormData()
      formData.append("text", bozza)
      formData.append("mentions", JSON.stringify(bozzaMenzioni))
      const risposta = await fetch(`${basePath}/${noteId}`, { method: "PATCH", body: formData })
      if (!risposta.ok) throw new Error()
      const aggiornata = (await risposta.json()) as { testo?: string; menzioni?: NoteMention[] }
      onModificata(aggiornata.testo ?? bozza, aggiornata.menzioni ?? [])
      setModifica(false)
    } catch {
      toast.error("Modifica non riuscita")
    } finally {
      setInCorso(false)
    }
  }

  async function elimina() {
    if (!window.confirm("Eliminare questa nota? Sparisce dalla scheda.")) return
    setInCorso(true)
    try {
      const risposta = await fetch(`${basePath}/${noteId}`, { method: "DELETE" })
      if (!risposta.ok) throw new Error()
      onEliminata()
    } catch {
      toast.error("Eliminazione non riuscita")
    } finally {
      setInCorso(false)
    }
  }

  if (modifica) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <RichNoteComposer
          value={bozza}
          onChange={setBozza}
          mentions={bozzaMenzioni}
          onMentionsChange={setBozzaMenzioni}
          files={allegati}
          onFilesChange={setAllegati}
          rows={3}
          className="bg-card text-[13px]"
          disabled={inCorso}
        />
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={inCorso}
            onClick={() => {
              setBozza(testo)
              setBozzaMenzioni(menzioni ?? [])
              setModifica(false)
            }}
          >
            <IconX size={14} data-icon="inline-start" />
            Annulla
          </Button>
          <Button size="sm" disabled={inCorso || !bozza.trim()} onClick={() => void salva()}>
            <IconCheck size={14} data-icon="inline-start" />
            Salva
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="ml-auto flex items-center gap-0.5 text-muted-foreground/70">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Modifica nota"
        disabled={inCorso}
        onClick={() => setModifica(true)}
      >
        <IconPencil size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-destructive hover:text-destructive"
        aria-label="Elimina nota"
        disabled={inCorso}
        onClick={() => void elimina()}
      >
        <IconTrash size={14} />
      </Button>
    </div>
  )
}
