"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  IconExternalLink,
  IconPencil,
  IconTrash,
  IconUserEdit,
  IconTag,
  IconCheck,
  IconToggleLeft,
  IconNote,
  IconChecklist,
} from "@tabler/icons-react"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MentionTextarea } from "@/components/shared/note-mentions"
import type { NoteMentionDraft } from "@/lib/notes/mentions"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatDMY } from "@/components/compiti/new-compito-dialog"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import { installatoriKeys, useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import { InstallatoreTagPickerReal } from "./installatore-tag-controls"
import { usePermissions } from "@/lib/permissions/provider"

// "Gestisci tag" ora usa il sistema multi-tag reale (tag/installatore_tags)
// al posto del vecchio campo singolo di testo libero installatori.tag —
// ricostruito il 26/07. "Crea nota"/"Crea attività" aggiunti nello stesso
// intervento (i Compiti accettano gia' "Correlato a" generico per
// qualunque tipo, nessuna modifica lato Compiti servita).

export function InstallatoreRowContextMenu({
  installatore,
  children,
  onEdit,
  onDelete,
}: {
  installatore: InstallatoreRecord
  children: ReactNode
  onEdit: (i: InstallatoreRecord) => void
  onDelete: (i: InstallatoreRecord) => void
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const permissions = usePermissions()
  const { data: referenceData } = useInstallatoriReferenceData()
  const proprietari = referenceData?.owners ?? []
  const [tagOpen, setTagOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [noteMentions, setNoteMentions] = useState<NoteMentionDraft[]>([])
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskPriority, setTaskPriority] = useState("Medio")
  const [saving, setSaving] = useState(false)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/installatori/${installatore.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error("Aggiornamento non riuscito")
    qc.invalidateQueries({ queryKey: installatoriKeys.lists() })
    qc.invalidateQueries({ queryKey: installatoriKeys.referenceData() })
  }

  const changeOwner = async (ownerId: string, ownerNome: string) => {
    try {
      await patch({ proprietario_id: ownerId })
      toast.success("Proprietario aggiornato", {
        description: `${installatore.nome} → ${ownerNome}`,
      })
    } catch {
      toast.error("Errore nell'aggiornamento del proprietario")
    }
  }

  const toggleAttivo = async () => {
    try {
      await patch({ attivo: !installatore.attivo })
      toast.success(installatore.attivo ? "Impostato non attivo" : "Impostato attivo", {
        description: installatore.nome,
      })
    } catch {
      toast.error("Errore nell'aggiornamento dello stato")
    }
  }

  async function createNote() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/installatori/${installatore.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText, mentions: noteMentions }),
      })
      if (!response.ok) throw new Error()
      const result = (await response.json()) as { notificationFailures?: number }
      setNoteText("")
      setNoteMentions([])
      setNoteOpen(false)
      toast.success("Nota creata")
      if (result.notificationFailures) toast.warning("Nota salvata, ma una o più notifiche email non sono state inviate")
    } catch {
      toast.error("Creazione nota non riuscita")
    } finally {
      setSaving(false)
    }
  }

  async function createTask() {
    if (!taskTitle.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/compiti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Oggetto: taskTitle,
          Stato: "Non iniziato",
          Priorità: taskPriority,
          "Data di scadenza": taskDueDate ? formatDMY(taskDueDate) : "",
          "Correlato a": {
            tipo: "Installatore",
            id: installatore.id,
            nome: installatore.nome,
            linkable: true,
          },
        }),
      })
      if (!response.ok) throw new Error()
      setTaskTitle("")
      setTaskDueDate("")
      setTaskPriority("Medio")
      setTaskOpen(false)
      toast.success("Attività creata")
    } catch {
      toast.error("Creazione attività non riuscita")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={children as never} />
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuGroupLabel>Azioni rapide</ContextMenuGroupLabel>

            <ContextMenuItem onClick={() => router.push(`/installatori/${installatore.id}`)}>
              <IconExternalLink size={15} stroke={1.8} />
              Apri installatore
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onEdit(installatore)}>
              <IconPencil size={15} stroke={1.8} />
              Modifica
            </ContextMenuItem>
            <ContextMenuItem onClick={toggleAttivo}>
              <IconToggleLeft size={15} stroke={1.8} />
              {installatore.attivo ? "Imposta non attivo" : "Imposta attivo"}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setNoteOpen(true)}>
              <IconNote size={16} stroke={2} className="text-[#d08a00]" />
              Crea nota
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setTaskOpen(true)}>
              <IconChecklist size={16} stroke={2} className="text-[#356fd2]" />
              Crea attività
            </ContextMenuItem>

            <ContextMenuItem onClick={() => setTagOpen(true)}>
              <IconTag size={15} stroke={1.8} />
              Gestisci tag
            </ContextMenuItem>

            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconUserEdit size={15} stroke={1.8} />
                Cambia proprietario
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {proprietari.length === 0 ? (
                  <ContextMenuItem disabled>Nessun utente attivo</ContextMenuItem>
                ) : (
                  proprietari.map((p) => (
                    <ContextMenuItem key={p.id} onClick={() => changeOwner(p.id, p.nome)}>
                      {installatore.proprietario_id === p.id ? (
                        <IconCheck size={15} stroke={2} className="text-teal" />
                      ) : (
                        <span className="size-[15px]" />
                      )}
                      {p.nome}
                    </ContextMenuItem>
                  ))
                )}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>

          {permissions.canRecord("installatori", "delete") ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => onDelete(installatore)}>
                <IconTrash size={15} stroke={1.8} />
                Elimina
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="gap-3 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gestisci tag</DialogTitle>
          </DialogHeader>
          <InstallatoreTagPickerReal
            installatoreId={installatore.id}
            onDone={() => setTagOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconNote size={20} className="text-[#d08a00]" />
              Crea nota
            </DialogTitle>
            <DialogDescription>
              La nota sarà collegata a {installatore.nome}.
            </DialogDescription>
          </DialogHeader>
          <MentionTextarea
            value={noteText}
            onChange={setNoteText}
            mentions={noteMentions}
            onMentionsChange={setNoteMentions}
            placeholder="Scrivi una nota..."
            className="min-h-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Annulla
            </Button>
            <Button onClick={createNote} disabled={saving || !noteText.trim()}>
              Salva nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconChecklist size={20} className="text-[#356fd2]" />
              Crea attività
            </DialogTitle>
            <DialogDescription>
              Il compito sarà collegato a {installatore.nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`task-title-${installatore.id}`}>Oggetto</Label>
              <Input
                id={`task-title-${installatore.id}`}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Es. Richiamare l'installatore"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`task-date-${installatore.id}`}>Scadenza</Label>
                <Input
                  id={`task-date-${installatore.id}`}
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`task-priority-${installatore.id}`}>Priorità</Label>
                <select
                  id={`task-priority-${installatore.id}`}
                  value={taskPriority}
                  onChange={(event) => setTaskPriority(event.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="Basso">Bassa</option>
                  <option value="Medio">Media</option>
                  <option value="Alto">Alta</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>
              Annulla
            </Button>
            <Button onClick={createTask} disabled={saving || !taskTitle.trim()}>
              Crea attività
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
