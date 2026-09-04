"use client"

import { useState } from "react"
import { toast } from "sonner"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SEDE_LABELS,
  type ClienteRecord,
  type StatoCliente,
  type SedeLabel,
} from "@/lib/mock-data"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { useStatoClienteQuery } from "@/lib/clienti/stato-cliente-store"

interface NewClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (cliente: ClienteRecord) => Promise<void>
}

const SEDE_ITEMS = Object.fromEntries(SEDE_LABELS.map((s) => [s, s]))

interface FormState {
  nome: string
  cognome: string
  email: string
  cellulare: string
  stato: StatoCliente
  sede: SedeLabel
  proprietario: string
  installatore: string
}

const EMPTY_FORM: FormState = {
  nome: "",
  cognome: "",
  email: "",
  cellulare: "",
  stato: "Nuovo contratto digitale",
  sede: SEDE_LABELS[0],
  proprietario: "",
  installatore: "",
}

function nowStamp() {
  const d = new Date()
  const date = d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${date} ${time}`
}

export function NewClienteDialog({
  open,
  onOpenChange,
  onCreate,
}: NewClienteDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { owners, installers, loading } = useClienteTags()
  const { data: statoOptions } = useStatoClienteQuery()
  const statoValues = (statoOptions ?? []).map((s) => s.valore)
  const STATO_ITEMS = Object.fromEntries(statoValues.map((s) => [s, s]))
  const ownerItems = Object.fromEntries(owners.map((owner) => [owner.id, owner.nome]))
  const installerItems = Object.fromEntries(installers.map((installer) => [installer.id, installer.nome]))

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canSubmit = form.nome.trim() !== "" && form.cognome.trim() !== ""

  const handleSubmit = async () => {
    if (!canSubmit || saving || loading) return
    const stamp = nowStamp()
    const nomeCompleto = `${form.nome.trim()} ${form.cognome.trim()}`.trim()
    const cliente: ClienteRecord = {
      id: `cli-${Date.now()}`,
      "Badge dell'attività": false,
      "Badge di nota": false,
      "Nome Clienti": nomeCompleto,
      "E-mail": form.email.trim(),
      "Ora modifica": stamp,
      Tag: [],
      Sede: form.sede,
      Nome: form.nome.trim(),
      Cognome: form.cognome.trim(),
      Cellulare: form.cellulare.trim(),
      "Clienti Proprietario": form.proprietario,
      Installatore: installers.find((installer) => installer.id === form.installatore)?.nome,
      InstallatoreId: form.installatore || null,
      "Creato da": form.proprietario,
      "Ora creazione": stamp,
      Stato: form.stato,
    }
    setSaving(true)
    try {
      await onCreate(cliente)
      toast.success("Cliente creato", { description: `${nomeCompleto} è stato aggiunto all'elenco.` })
      setForm(EMPTY_FORM)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creazione non riuscita")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dati principali. Potrai completare la scheda dopo la
            creazione.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-nome">Nome</Label>
            <Input
              id="cli-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Mario"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-cognome">Cognome *</Label>
            <Input
              id="cli-cognome"
              value={form.cognome}
              onChange={(e) => set("cognome", e.target.value)}
              placeholder="Rossi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-email">E-mail</Label>
            <Input
              id="cli-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="mario.rossi@email.it"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-cellulare">Cellulare</Label>
            <Input
              id="cli-cellulare"
              value={form.cellulare}
              onChange={(e) => set("cellulare", e.target.value)}
              placeholder="+39 ..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-stato">Stato</Label>
            <Select
              items={STATO_ITEMS}
              value={form.stato}
              onValueChange={(v) => set("stato", v as StatoCliente)}
            >
              <SelectTrigger id="cli-stato">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statoValues.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-sede">Sede</Label>
            <Select
              items={SEDE_ITEMS}
              value={form.sede}
              onValueChange={(v) => set("sede", v as SedeLabel)}
            >
              <SelectTrigger id="cli-sede">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SEDE_LABELS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-proprietario">Clienti Proprietario</Label>
            <Select
              items={ownerItems}
              value={form.proprietario}
              onValueChange={(v) => set("proprietario", v ?? "")}
            >
              <SelectTrigger id="cli-proprietario">
                <SelectValue placeholder="Seleziona proprietario" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {owners.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cli-installatore">Installatore</Label>
            <Select
              items={installerItems}
              value={form.installatore}
              onValueChange={(v) => set("installatore", v ?? "")}
            >
              <SelectTrigger id="cli-installatore">
                <SelectValue placeholder="Seleziona installatore" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {installers.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!canSubmit || saving || loading}
            onClick={handleSubmit}
          >
            {saving ? "Salvataggio..." : "Crea cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
