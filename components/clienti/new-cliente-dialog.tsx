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
  STATO_CLIENTE_VALUES,
  SEDE_LABELS,
  mockCommerciali,
  mockInstallatori,
  type ClienteRecord,
  type StatoCliente,
  type SedeLabel,
} from "@/lib/mock-data"

interface NewClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (cliente: ClienteRecord) => void
}

const STATO_ITEMS = Object.fromEntries(STATO_CLIENTE_VALUES.map((s) => [s, s]))
const SEDE_ITEMS = Object.fromEntries(SEDE_LABELS.map((s) => [s, s]))
const COMM_ITEMS = Object.fromEntries(mockCommerciali.map((c) => [c, c]))
const INST_ITEMS = Object.fromEntries(mockInstallatori.map((i) => [i, i]))

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
  proprietario: mockCommerciali[0],
  installatore: mockInstallatori[0],
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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canSubmit = form.nome.trim() !== "" && form.cognome.trim() !== ""

  const handleSubmit = () => {
    if (!canSubmit) return
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
      Installatore: form.installatore,
      "Creato da": form.proprietario,
      "Ora creazione": stamp,
      Stato: form.stato,
    }
    onCreate(cliente)
    toast.success("Cliente creato", {
      description: `${nomeCompleto} è stato aggiunto all'elenco.`,
    })
    setForm(EMPTY_FORM)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>Stato</Label>
            <Select
              items={STATO_ITEMS}
              value={form.stato}
              onValueChange={(v) => set("stato", v as StatoCliente)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATO_CLIENTE_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sede</Label>
            <Select
              items={SEDE_ITEMS}
              value={form.sede}
              onValueChange={(v) => set("sede", v as SedeLabel)}
            >
              <SelectTrigger>
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
            <Label>Clienti Proprietario</Label>
            <Select
              items={COMM_ITEMS}
              value={form.proprietario}
              onValueChange={(v) => set("proprietario", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockCommerciali.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Installatore</Label>
            <Select
              items={INST_ITEMS}
              value={form.installatore}
              onValueChange={(v) => set("installatore", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockInstallatori.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Crea cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
