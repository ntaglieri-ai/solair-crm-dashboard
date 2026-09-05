"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { usePermissions } from "@/lib/permissions/provider"
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
  type Lead,
  type StatoLead,
  type OrigineLead,
  type SedeLabel,
} from "@/lib/mock-data"
import { useTags } from "@/lib/tag-store"
import { option } from "@/lib/crm-settings/column-values"
import { useColumnValueOptions } from "@/lib/crm-settings/use-column-values"

interface NewLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (lead: Lead) => void
}

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

// Genera un timestamp in formato ISO (es. "2026-07-25T12:20:00.000Z"), non
// il formato italiano GG/MM/AAAA — quest'ultimo mandava PostgreSQL in
// errore ("date/time field value out of range") ogni volta che il giorno
// del mese superava 12, perche' veniva letto come mese (es. "25/07" letto
// come mese 25, invalido). Trovato e sistemato il 25/07 durante il test
// della creazione lead.
function nowStamp() {
  return new Date().toISOString()
}

export function NewLeadDialog({
  open,
  onOpenChange,
  onCreate,
}: NewLeadDialogProps) {
  const { owners } = useTags()
  const permissions = usePermissions()
  const currentUserId = permissions.snapshot.subject.userId ?? ""
  // Un Agente/Standard puo' inserire solo lead assegnati a se' stesso o non
  // assegnati (regola di sicurezza a livello di database) — mostrargli
  // l'intero elenco proprietari e' fuorviante, dato che scegliere chiunque
  // altro fallirebbe comunque. Direttore+/Admin/Superadmin vedono tutti.
  const assignableOwners =
    permissions.getScope("lead") === "all"
      ? owners
      : owners.filter((owner) => owner.id === currentUserId)
  const ownerItems = useMemo(
    () => Object.fromEntries(owners.map((owner) => [owner.id, owner.nome])),
    [owners],
  )
  const statoOptions = useColumnValueOptions(
    "Lead",
    "stato_lead",
    STATO_LEAD_ORDER.map((s) => option(s)),
    { includeFallback: true },
  ).options
  const origineOptions = useColumnValueOptions(
    "Lead",
    "origine_lead",
    ORIGINE_LEAD_VALUES.map((o) => option(o)),
    { includeFallback: true },
  ).options
  const sedeOptions = useColumnValueOptions(
    "Lead",
    "sede",
    SEDE_LABELS.map((s) => option(s)),
    { includeFallback: true },
  ).options
  const statoItems = useMemo(
    () => Object.fromEntries(statoOptions.map((s) => [s.value, s.label])),
    [statoOptions],
  )
  const origineItems = useMemo(
    () => Object.fromEntries(origineOptions.map((o) => [o.value, o.label])),
    [origineOptions],
  )
  const sedeItems = useMemo(
    () => Object.fromEntries(sedeOptions.map((s) => [s.value, s.label])),
    [sedeOptions],
  )
  const defaultForm = useMemo<FormState>(
    () => ({
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      citta: "",
      provincia: "",
      stato: statoOptions[0]?.value ?? "Non contattato",
      origine:
        origineOptions.find((item) => item.value === "Manuale")?.value ??
        origineOptions[0]?.value ??
        "Manuale",
      sede: sedeOptions[0]?.value ?? SEDE_LABELS[0],
      proprietario: "",
      descrizione: "",
    }),
    [origineOptions, sedeOptions, statoOptions],
  )
  const [form, setForm] = useState<FormState>(() => defaultForm)

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
      "Lead Proprietario": form.proprietario || currentUserId,
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
      Stato: "—",
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
    setForm(defaultForm)
    onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setForm(defaultForm)
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
              items={statoItems}
              value={form.stato}
              onValueChange={(v) => set("stato", v as StatoLead)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statoOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Origine</Label>
            <Select
              items={origineItems}
              value={form.origine}
              onValueChange={(v) => set("origine", v as OrigineLead)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {origineOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Sede</Label>
            <Select
              items={sedeItems}
              value={form.sede}
              onValueChange={(v) => set("sede", v as SedeLabel)}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sedeOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Proprietario</Label>
            <Select
              items={ownerItems}
              value={form.proprietario || currentUserId}
              onValueChange={(v) => set("proprietario", v ?? "")}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {assignableOwners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.nome}
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
