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
  INSTALLATORE_STATO_VALUES,
  mockInstallatoreProprietari,
  type InstallatoreRecord,
  type InstallatoreStato,
} from "@/lib/mock-data"

interface NewInstallatoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (installatore: InstallatoreRecord) => void
}

const STATO_ITEMS = Object.fromEntries(
  INSTALLATORE_STATO_VALUES.map((s) => [s, s]),
)
const PROP_ITEMS = Object.fromEntries(
  mockInstallatoreProprietari.map((c) => [c, c]),
)

interface FormState {
  nome: string
  referente: string
  email: string
  cellulare: string
  partitaIva: string
  stato: InstallatoreStato
  proprietario: string
}

const EMPTY_FORM: FormState = {
  nome: "",
  referente: "",
  email: "",
  cellulare: "",
  partitaIva: "",
  stato: "Attivo",
  proprietario: mockInstallatoreProprietari[0],
}

function nowStamp() {
  const d = new Date()
  const date = d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${date} ${time}`
}

export function NewInstallatoreDialog({
  open,
  onOpenChange,
  onCreate,
}: NewInstallatoreDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canSubmit = form.nome.trim() !== ""

  const handleSubmit = () => {
    if (!canSubmit) return
    const stamp = nowStamp()
    const installatore: InstallatoreRecord = {
      id: `inst-${Date.now()}`,
      "Badge dell'attività": false,
      "Badge di nota": false,
      Tag: [],
      "Nome Installatore": form.nome.trim(),
      "E-mail": form.email.trim(),
      "Proprietario di Installatore": form.proprietario,
      "Ora modifica": stamp,
      Stato: form.stato,
      "Persona di riferimento": form.referente.trim(),
      Cellulare: form.cellulare.trim(),
      "Partita IVA": form.partitaIva.trim(),
      "Connesso a": form.nome.trim(),
      "Creato da": form.proprietario,
      "Modificato da": form.proprietario,
      "Ora creazione": stamp,
      "Ora ultima attività": stamp,
      "Opt-out e-mail": false,
      Bloccato: false,
      "Modalità iscrizione annullata": null,
      "Ora iscrizione annullata": null,
    }
    onCreate(installatore)
    toast.success("Installatore creato", {
      description: `${form.nome.trim()} è stato aggiunto all'elenco.`,
    })
    setForm(EMPTY_FORM)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo installatore</DialogTitle>
          <DialogDescription>
            Inserisci i dati principali. Potrai completare la scheda dopo la
            creazione.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="inst-nome">Nome Installatore *</Label>
            <Input
              id="inst-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Es. DG Impianti"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-referente">Persona di riferimento</Label>
            <Input
              id="inst-referente"
              value={form.referente}
              onChange={(e) => set("referente", e.target.value)}
              placeholder="Mario Rossi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-piva">Partita IVA</Label>
            <Input
              id="inst-piva"
              value={form.partitaIva}
              onChange={(e) => set("partitaIva", e.target.value)}
              placeholder="IT01234560871"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-email">E-mail</Label>
            <Input
              id="inst-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="info@azienda.it"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-cellulare">Cellulare</Label>
            <Input
              id="inst-cellulare"
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
              onValueChange={(v) => set("stato", v as InstallatoreStato)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {INSTALLATORE_STATO_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Proprietario di Installatore</Label>
            <Select
              items={PROP_ITEMS}
              value={form.proprietario}
              onValueChange={(v) => set("proprietario", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockInstallatoreProprietari.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
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
            Crea installatore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
