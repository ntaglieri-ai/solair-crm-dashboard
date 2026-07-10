"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconTag,
  IconUserEdit,
  IconArrowRight,
  IconExternalLink,
  IconCopy,
  IconDownload,
  IconTrash,
  IconCheck,
  IconPencil,
  IconPhone,
  IconMail,
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  type Lead,
  type StatoLead,
} from "@/lib/mock-data"
import { TagPicker } from "./tag-controls"
import { useTags } from "@/lib/tag-store"
import { formatDMY } from "@/components/compiti/new-compito-dialog"

const STATI: StatoLead[] = [
  "Non contattato",
  "Contattato",
  "Tentato di contattare",
  "Inviato Preventivo",
  "Convertito",
  "Perso",
]

export function LeadRowContextMenu({
  lead,
  children,
  onDelete,
  onUpdate,
  onDuplicate,
  onRefresh,
}: {
  lead: Lead
  children: ReactNode
  onDelete: (lead: Lead) => void
  onUpdate: (lead: Lead, patch: Partial<Lead>) => void
  onDuplicate: (lead: Lead) => void
  onRefresh: () => void
}) {
  const { owners } = useTags()
  const router = useRouter()
  const [tagOpen, setTagOpen] = useState(false)
  const [owner, setOwner] = useState(lead["Lead Proprietario"] ?? "")
  const [stato, setStato] = useState<StatoLead>(lead["Stato Lead"])
  const [confirmDup, setConfirmDup] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: lead["Nome Lead"],
    email: lead["E-mail"],
    phone: lead.Telefono,
    city: lead["Città"],
    province: lead.Provincia,
  })
  const [noteText, setNoteText] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskPriority, setTaskPriority] = useState("Medio")
  const [saving, setSaving] = useState(false)

  const exportRow = () => {
    const payload = Object.fromEntries(
      Object.entries(lead).filter(([, value]) => !Array.isArray(value)),
    )
    const columns = Object.keys(payload)
    const line = columns.map((column) =>
      `"${String(payload[column] ?? "").replace(/"/g, '""')}"`,
    )
    const blob = new Blob([`${columns.join(";")}\n${line.join(";")}`], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `lead-${lead.id}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Esportazione avviata", {
      description: `Lead "${lead["Nome Lead"]}" esportato in CSV.`,
    })
  }

  async function createNote() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      })
      if (!response.ok) throw new Error()
      setNoteText("")
      setNoteOpen(false)
      onRefresh()
      toast.success("Nota creata")
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
          Sede: lead.Sede || undefined,
          "Correlato a": {
            tipo: "Lead",
            id: lead.id,
            nome: lead["Nome Lead"],
            linkable: true,
          },
        }),
      })
      if (!response.ok) throw new Error()
      setTaskTitle("")
      setTaskDueDate("")
      setTaskPriority("Medio")
      setTaskOpen(false)
      onRefresh()
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

            <ContextMenuItem onClick={() => router.push(`/leads/${lead.id}`)}>
              <IconExternalLink size={15} stroke={1.8} />
              Apri scheda lead
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => setEditOpen(true)}
            >
              <IconPencil size={15} stroke={1.8} />
              Modifica lead
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!lead.Telefono}
              onClick={() => {
                if (lead.Telefono) window.location.href = `tel:${lead.Telefono}`
              }}
            >
              <IconPhone size={15} stroke={1.8} />
              Chiama
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!lead["E-mail"]}
              onClick={() => {
                if (lead["E-mail"])
                  window.location.href = `mailto:${lead["E-mail"]}`
              }}
            >
              <IconMail size={15} stroke={1.8} />
              Invia email
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setNoteOpen(true)}>
              <IconNote size={16} stroke={2} className="text-[#d08a00]" />
              Crea nota
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setTaskOpen(true)}>
              <IconChecklist size={16} stroke={2} className="text-[#356fd2]" />
              Crea attività
            </ContextMenuItem>

            <ContextMenuSeparator />

            {/* Gestisci tag -> apre dialog, non popover annidato nel menu item */}
            <ContextMenuItem onClick={() => setTagOpen(true)}>
              <IconTag size={15} stroke={1.8} />
              Gestisci tag
            </ContextMenuItem>

            {/* Cambia proprietario */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconUserEdit size={15} stroke={1.8} />
                Assegna commerciale
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {owners.map((option) => (
                  <ContextMenuItem
                    key={option.id}
                    onClick={() => {
                      setOwner(option.id)
                      onUpdate(lead, { "Lead Proprietario": option.id })
                      toast.success("Proprietario aggiornato", {
                        description: `${lead["Nome Lead"]} → ${option.nome}`,
                      })
                    }}
                  >
                    {owner === option.id ? (
                      <IconCheck size={15} stroke={2} className="text-teal" />
                    ) : (
                      <span className="size-[15px]" />
                    )}
                    {option.nome}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            {/* Cambia stato */}
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconArrowRight size={15} stroke={1.8} />
                Cambia stato
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {STATI.map((s) => (
                  <ContextMenuItem
                    key={s}
                    onClick={() => {
                      setStato(s)
                      onUpdate(lead, { "Stato Lead": s })
                      toast.success("Stato aggiornato", {
                        description: `${lead["Nome Lead"]} → ${s}`,
                      })
                    }}
                  >
                    {stato === s ? (
                      <IconCheck size={15} stroke={2} className="text-teal" />
                    ) : (
                      <span className="size-[15px]" />
                    )}
                    {s}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuGroup>
            <ContextMenuGroupLabel>Navigazione</ContextMenuGroupLabel>
            <ContextMenuItem onClick={() => setConfirmDup(true)}>
              <IconCopy size={15} stroke={1.8} />
              Duplica lead
            </ContextMenuItem>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={exportRow}>
            <IconDownload size={15} stroke={1.8} />
            Esporta questo lead
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onClick={() => setConfirmDel(true)}>
            <IconTrash size={15} stroke={1.8} />
            Elimina
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="gap-3 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gestisci tag</DialogTitle>
          </DialogHeader>
          <TagPicker leadId={lead.id} onDone={() => setTagOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog duplica */}
      <Dialog open={confirmDup} onOpenChange={setConfirmDup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplica lead</DialogTitle>
            <DialogDescription>
              Creare una copia di{" "}
              <span className="font-medium text-foreground">
                {lead["Nome Lead"]}
              </span>
              ? La copia conserverà tag e dati principali.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDup(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                setConfirmDup(false)
                onDuplicate(lead)
              }}
            >
              Duplica
            </Button>
          </DialogFooter>
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
              La nota sarà collegata a {lead["Nome Lead"]}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Scrivi una nota..."
            className="min-h-28"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Annulla</Button>
            <Button onClick={createNote} disabled={saving || !noteText.trim()}>
              Salva nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica lead</DialogTitle>
            <DialogDescription>
              Aggiorna i dati principali di {lead["Nome Lead"]}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-name-${lead.id}`}>Nome lead</Label>
              <Input
                id={`edit-name-${lead.id}`}
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-email-${lead.id}`}>Email</Label>
                <Input
                  id={`edit-email-${lead.id}`}
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-phone-${lead.id}`}>Telefono</Label>
                <Input
                  id={`edit-phone-${lead.id}`}
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-city-${lead.id}`}>Città</Label>
                <Input
                  id={`edit-city-${lead.id}`}
                  value={editForm.city}
                  onChange={(event) => setEditForm({ ...editForm, city: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`edit-province-${lead.id}`}>Provincia</Label>
                <Input
                  id={`edit-province-${lead.id}`}
                  value={editForm.province}
                  onChange={(event) => setEditForm({ ...editForm, province: event.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
            <Button
              disabled={!editForm.name.trim()}
              onClick={() => {
                onUpdate(lead, {
                  "Nome Lead": editForm.name.trim(),
                  "E-mail": editForm.email.trim(),
                  Telefono: editForm.phone.trim(),
                  "Città": editForm.city.trim(),
                  Provincia: editForm.province.trim(),
                })
                setEditOpen(false)
              }}
            >
              Salva modifiche
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
              Il compito sarà collegato a {lead["Nome Lead"]}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`task-title-${lead.id}`}>Oggetto</Label>
              <Input
                id={`task-title-${lead.id}`}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Es. Richiamare il lead"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`task-date-${lead.id}`}>Scadenza</Label>
                <Input
                  id={`task-date-${lead.id}`}
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`task-priority-${lead.id}`}>Priorità</Label>
                <select
                  id={`task-priority-${lead.id}`}
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
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Annulla</Button>
            <Button onClick={createTask} disabled={saving || !taskTitle.trim()}>
              Crea attività
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog elimina */}
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina lead</DialogTitle>
            <DialogDescription>
              Vuoi eliminare{" "}
              <span className="font-medium text-foreground">
                {lead["Nome Lead"]}
              </span>
              ? L&apos;azione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDel(false)
                onDelete(lead)
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
