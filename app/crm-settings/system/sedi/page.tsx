"use client"

import { useState } from "react"
import {
  Building2,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { sediIniziali, type SystemSede } from "@/lib/system-settings-data"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"

export default function SediPage() {
  const [sedi, setSedi, store] = usePersistentSystemSetting<SystemSede[]>(
    "system.sedi",
    sediIniziali,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SystemSede | null>(null)
  const [nome, setNome] = useState("")
  const [indirizzo, setIndirizzo] = useState("")

  function openNew() {
    setEditing(null)
    setNome("")
    setIndirizzo("")
    setDialogOpen(true)
  }

  function openEdit(sede: SystemSede) {
    setEditing(sede)
    setNome(sede.nome)
    setIndirizzo(sede.indirizzo)
    setDialogOpen(true)
  }

  function handleSave() {
    if (!nome.trim()) return
    if (editing) {
      setSedi((prev) =>
        prev.map((s) =>
          s.id === editing.id ? { ...s, nome, indirizzo } : s,
        ),
      )
    } else {
      setSedi((prev) => [
        ...prev,
        {
          id: `sed_${Date.now()}`,
          nome,
          indirizzo,
          attiva: true,
          utenti: 0,
        },
      ])
    }
    setDialogOpen(false)
  }

  function toggleAttiva(id: string) {
    setSedi((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attiva: !s.attiva } : s)),
    )
  }

  function handleDelete(id: string) {
    setSedi((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Sedi"
        description={
          store.saving
            ? "Salvataggio configurazione..."
            : "Gestisci le sedi operative di Solair Group. Le sedi sono attributi assegnabili agli utenti."
        }
        action={
          <Button onClick={openNew} className="bg-teal text-teal-foreground hover:bg-teal/90">
            <Plus className="size-4" />
            Aggiungi sede
          </Button>
        }
      />

      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {sedi.map((sede) => (
          <div
            key={sede.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                <Building2 className="size-5" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {sede.nome}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {sede.indirizzo}
                </span>
                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Users className="size-3" />
                  {sede.utenti} {sede.utenti === 1 ? "utente" : "utenti"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Switch
                checked={sede.attiva}
                onCheckedChange={() => toggleAttiva(sede.id)}
                aria-label={`Sede ${sede.nome} attiva`}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Azioni per ${sede.nome}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(sede)}>
                    <Pencil className="size-4" />
                    Modifica
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDelete(sede.id)}
                  >
                    <Trash2 className="size-4" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifica sede" : "Aggiungi sede"}
            </DialogTitle>
            <DialogDescription>
              Le sedi sono attributi assegnabili agli utenti del CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sede-nome">Nome sede</Label>
              <Input
                id="sede-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Catania"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sede-indirizzo">Indirizzo</Label>
              <Input
                id="sede-indirizzo"
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Via, numero civico, CAP, città"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
