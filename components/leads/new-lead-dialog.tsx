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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  STATO_LEAD_ORDER,
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
  mockCommerciali,
  type Lead,
  type StatoLead,
  type OrigineLead,
  type SedeLabel,
} from "@/lib/mock-data"

interface NewLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (lead: Lead) => void
}

const STATO_ITEMS = Object.fromEntries(STATO_LEAD_ORDER.map((s) => [s, s]))
const ORIGINE_ITEMS = Object.fromEntries(ORIGINE_LEAD_VALUES.map((o) => [o, o]))
const SEDE_ITEMS = Object.fromEntries(SEDE_LABELS.map((s) => [s, s]))
const COMM_ITEMS = Object.fromEntries(mockCommerciali.map((c) => [c, c]))

interface FormState {
  nome: string
  cognome: string
  email: string
  telefono: string
  citta: string
  provincia: string
  stato: StatoLead
  origine: OrigineLead
  sede: SedeLabel
  proprietario: string
  descrizione: string
}

const EMPTY_FORM: FormState = {
  nome: "",
  cognome: "",
  email: "",
  telefono: "",
  citta: "",
  provincia: "",
  stato: "Non contattato",
  origine: "Manuale",
  sede: SEDE_LABELS[0],
  proprietario: mockCommerciali[0],
  descrizione: "",
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

export function NewLeadDialog({
  open,
  onOpenChange,
  onCreate,
}: NewLeadDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const nomeCompleto = `${form.nome} ${form.cognome}`.trim()
  const canSave = form.nome.trim() !== "" && form.email.trim() !== ""

  const handleSubmit = () => {
    if (!canSave) {
      toast.error("Campi obbligatori mancanti", {
        description: "Inserisci almeno nome ed e-mail per creare il lead.",
      })
      return
    }

    const stamp = nowStamp()
    const lead: Lead = {
      id: `lead-${Date.now()}`,
      "Badge dell'attività": false,
      "Badge di nota": false,
      Tag: [],
      "Nome Lead": nomeCompleto,
      "Lead Proprietario": form.proprietario,
      "Città": form.citta || "—",
      Provincia: form.provincia || "—",
      "Stato Lead": form.stato,
      "Data Click": stamp,
      "Ora creazione": stamp,
      "campaign name": "—",
      Telefono: form.telefono || "—",
      "Mobile/Fisso": "Mobile",
      "Origine Lead": form.origine,
      "E-mail": form.email,
      Stato: "Non inviata",
      Nome: form.nome,
      Cognome: form.cognome,
      "Creato da": form.proprietario,
      "Ora ultima attività": stamp,
      "Codice postale": "—",
      Paese: "Italia",
      Descrizione: form.descrizione,
      Valutazione: 0,
      "Tempo di conversione Lead": "—",
      "Modalità iscrizione annullata": null,
      "Ora iscrizione annullata": null,
      "Account convertito": null,
      "Contatto convertito": null,
      "Residente in Sicilia": false,
      "Social Lead ID": null,
      "Data sopralluogo": null,
      "Installatore - Incaricato sopralluogo": null,
      "Connesso a": null,
      "Data/Ora": stamp,
      kWp: 0,
      kWh: 0,
      "Modello pannello": "—",
      Sede: form.sede,
      "Wallbox richiesto": false,
      emailAperture: 0,
      leadCaldo: false,
      possibileDuplicato: false,
      attivita: [],
      documenti: [],
    }

    onCreate(lead)
    toast.success("Lead creato", {
      description: `${nomeCompleto} è stato aggiunto all'elenco.`,
    })
    setForm(EMPTY_FORM)
    onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setForm(EMPTY_FORM)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuovo lead</DialogTitle>
          <DialogDescription>
            Compila i dati principali. Nome ed e-mail sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-nome">Nome *</Label>
            <Input
              id="nl-nome"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Mario"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-cognome">Cognome</Label>
            <Input
              id="nl-cognome"
              value={form.cognome}
              onChange={(e) => set("cognome", e.target.value)}
              placeholder="Rossi"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-email">E-mail *</Label>
            <Input
              id="nl-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="mario.rossi@email.it"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-telefono">Telefono</Label>
            <Input
              id="nl-telefono"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              placeholder="+39 333 1234567"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-citta">Città</Label>
            <Input
              id="nl-citta"
              value={form.citta}
              onChange={(e) => set("citta", e.target.value)}
              placeholder="Catania"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nl-provincia">Provincia</Label>
            <Input
              id="nl-provincia"
              value={form.provincia}
              onChange={(e) => set("provincia", e.target.value)}
              placeholder="CT"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Stato lead</Label>
            <Select
              items={STATO_ITEMS}
              value={form.stato}
              onValueChange={(v) => set("stato", v as StatoLead)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATO_LEAD_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Origine</Label>
            <Select
              items={ORIGINE_ITEMS}
              value={form.origine}
              onValueChange={(v) => set("origine", v as OrigineLead)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ORIGINE_LEAD_VALUES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
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
              <SelectTrigger className="bg-card">
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
            <Label>Proprietario</Label>
            <Select
              items={COMM_ITEMS}
              value={form.proprietario}
              onValueChange={(v) => set("proprietario", v)}
            >
              <SelectTrigger className="bg-card">
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="nl-descrizione">Descrizione</Label>
            <Textarea
              id="nl-descrizione"
              value={form.descrizione}
              onChange={(e) => set("descrizione", e.target.value)}
              placeholder="Note iniziali sul lead, richiesta, kWp stimati…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={handleSubmit}
          >
            Crea lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
