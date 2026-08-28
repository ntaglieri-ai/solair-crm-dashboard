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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatDMY } from "@/components/compiti/new-compito-dialog"
import {
  STATO_CLIENTE_VALUES,
  type ClienteRecord,
  type StatoCliente,
} from "@/lib/mock-data"
import { ClienteTagPicker } from "./cliente-tag-controls"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { usePermissions } from "@/lib/permissions/provider"
import { EditRecordDialog, buildClienteEditFields } from "@/components/shared/edit-record-dialog"
import { telHref } from "@/components/shared/quick-contact-icons"

// "Crea nota"/"Crea attività" — costruiti il 25/07 (endpoint note dedicato
// app/api/clienti/[id]/notes, i compiti gia' accettavano "Correlato a"
// generico per qualunque tipo, "Cliente" incluso, nessuna modifica serviva
// li').

// Elenco stati preso da STATO_CLIENTE_VALUES invece di riscriverlo: era una
// copia identica, e una copia di un enum e' un posto in cui dimenticarsi di
// aggiungere il valore nuovo (successo aggiungendo "Necessario sopralluogo
// intervento", Fase 3.1). Filtri e dialog nuovo cliente leggono gia' da li'.

export function ClienteRowContextMenu({
  cliente,
  children,
  onDelete,
  onUpdate,
  onRefresh,
}: {
  cliente: ClienteRecord
  children: ReactNode
  onDelete: (cliente: ClienteRecord) => void
  onUpdate: (cliente: ClienteRecord, patch: Partial<ClienteRecord>) => void
  onRefresh: () => void
}) {
  const { owners } = useClienteTags()
  const permissions = usePermissions()
  const router = useRouter()
  const [tagOpen, setTagOpen] = useState(false)
  const [owner, setOwner] = useState(cliente["Clienti Proprietario"] ?? "")
  const [stato, setStato] = useState<StatoCliente>(cliente.Stato)
  const [confirmDel, setConfirmDel] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [taskPriority, setTaskPriority] = useState("Medio")
  const [saving, setSaving] = useState(false)

  async function createNote() {
    if (!noteText.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/clienti/${cliente.id}/notes`, {
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
          Sede: cliente.Sede || undefined,
          "Correlato a": {
            tipo: "Cliente",
            id: cliente.id,
            nome: cliente["Nome Clienti"],
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

  const exportRow = () => {
    const payload = Object.fromEntries(
      Object.entries(cliente).filter(([, value]) => !Array.isArray(value)),
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
    anchor.download = `cliente-${cliente.id}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Esportazione avviata", {
      description: `Cliente "${cliente["Nome Clienti"]}" esportato in CSV.`,
    })
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/clienti/${cliente.id}/duplica`, { method: "POST" })
      const result = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
      if (!res.ok || !result?.id) {
        toast.error(result?.error ?? "Duplicazione non riuscita")
        return
      }
      toast.success("Cliente duplicato")
      router.push(`/clienti/${result.id}`)
    } catch {
      toast.error("Duplicazione non riuscita: errore di rete")
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={children as never} />
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuGroupLabel>Azioni rapide</ContextMenuGroupLabel>

            <ContextMenuItem onClick={() => router.push(`/clienti/${cliente.id}`)}>
              <IconExternalLink size={15} stroke={1.8} />
              Apri scheda cliente
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setEditOpen(true)}>
              <IconPencil size={15} stroke={1.8} />
              Modifica cliente
            </ContextMenuItem>
            {/* Link tel: vero nel DOM, non navigazione via JS all'onClick:
                le estensioni click-to-call (3CX) intercettano solo un <a>
                gia' presente, altrimenti la chiamata passa all'app di
                sistema (FaceTime) invece che al centralino. */}
            <ContextMenuItem
              disabled={!cliente.Cellulare}
              render={
                cliente.Cellulare ? (
                  <a href={`tel:${telHref(cliente.Cellulare)}`} />
                ) : undefined
              }
            >
              <IconPhone size={15} stroke={1.8} />
              Chiama
            </ContextMenuItem>
            <ContextMenuItem
              disabled={!cliente["E-mail"]}
              onClick={() => {
                if (cliente["E-mail"]) window.location.href = `mailto:${cliente["E-mail"]}`
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

            <ContextMenuItem onClick={() => setTagOpen(true)}>
              <IconTag size={15} stroke={1.8} />
              Gestisci tag
            </ContextMenuItem>

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
                      onUpdate(cliente, { "Clienti Proprietario": option.id })
                      toast.success("Proprietario aggiornato", {
                        description: `${cliente["Nome Clienti"]} → ${option.nome}`,
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

            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <IconArrowRight size={15} stroke={1.8} />
                Cambia stato
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {STATO_CLIENTE_VALUES.map((s) => (
                  <ContextMenuItem
                    key={s}
                    onClick={() => {
                      setStato(s)
                      onUpdate(cliente, { Stato: s })
                      toast.success("Stato aggiornato", {
                        description: `${cliente["Nome Clienti"]} → ${s}`,
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
            <ContextMenuItem onClick={handleDuplicate} disabled={duplicating}>
              <IconCopy size={15} stroke={1.8} />
              {duplicating ? "Duplicazione..." : "Duplica cliente"}
            </ContextMenuItem>
          </ContextMenuGroup>

          <ContextMenuSeparator />

          <ContextMenuItem onClick={exportRow}>
            <IconDownload size={15} stroke={1.8} />
            Esporta questo cliente
          </ContextMenuItem>
          {permissions.canRecord("clienti", "delete") ? (
            <ContextMenuItem variant="destructive" onClick={() => setConfirmDel(true)}>
              <IconTrash size={15} stroke={1.8} />
              Elimina
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="gap-3 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Gestisci tag</DialogTitle>
          </DialogHeader>
          <ClienteTagPicker clienteId={cliente.id} onDone={() => setTagOpen(false)} />
        </DialogContent>
      </Dialog>

      <EditRecordDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifica cliente"
        endpoint={`/api/clienti/${cliente.id}`}
        fields={buildClienteEditFields(cliente, permissions)}
        onSaved={onRefresh}
      />

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconNote size={20} className="text-[#d08a00]" />
              Crea nota
            </DialogTitle>
            <DialogDescription>
              La nota sarà collegata a {cliente["Nome Clienti"]}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
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
              Il compito sarà collegato a {cliente["Nome Clienti"]}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`task-title-${cliente.id}`}>Oggetto</Label>
              <Input
                id={`task-title-${cliente.id}`}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Es. Richiamare il cliente"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`task-date-${cliente.id}`}>Scadenza</Label>
                <Input
                  id={`task-date-${cliente.id}`}
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`task-priority-${cliente.id}`}>Priorità</Label>
                <select
                  id={`task-priority-${cliente.id}`}
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

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina cliente</DialogTitle>
            <DialogDescription>
              Vuoi eliminare{" "}
              <span className="font-medium text-foreground">{cliente["Nome Clienti"]}</span>?
              L&apos;azione non è reversibile.
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
                onDelete(cliente)
                onRefresh()
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
