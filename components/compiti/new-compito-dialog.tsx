"use client"

import { useState } from "react"
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
  type Compito,
  type StatoCompito,
  type PrioritaCompito,
  type SedeLabel,
  STATO_COMPITO_ORDER,
  PRIORITA_COMPITO_ORDER,
  SEDE_LABELS,
  mockProprietariCompito,
} from "@/lib/mock-data"

function formatDMY(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

function stampNow(): string {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`
}

export function NewCompitoDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreate: (compito: Compito) => void
}) {
  const [oggetto, setOggetto] = useState("")
  const [stato, setStato] = useState<StatoCompito>("Non iniziato")
  const [priorita, setPriorita] = useState<PrioritaCompito>("Medio")
  const [scadenza, setScadenza] = useState("")
  const [proprietario, setProprietario] = useState(mockProprietariCompito[0])
  const [sede, setSede] = useState<SedeLabel>(SEDE_LABELS[0])
  const [descrizione, setDescrizione] = useState("")

  const reset = () => {
    setOggetto("")
    setStato("Non iniziato")
    setPriorita("Medio")
    setScadenza("")
    setProprietario(mockProprietariCompito[0])
    setSede(SEDE_LABELS[0])
    setDescrizione("")
  }

  const submit = () => {
    if (!oggetto.trim() || !scadenza) return
    const compito: Compito = {
      id: `task-${Date.now()}`,
      Oggetto: oggetto.trim(),
      Stato: stato,
      Priorità: priorita,
      "Data di scadenza": formatDMY(scadenza),
      "Proprietario del compito": proprietario,
      Sede: sede,
      "Correlato a": null,
      Descrizione: descrizione.trim(),
      Promemoria: null,
      "Data di creazione": stampNow(),
      "Orario di chiusura": null,
      Note: [],
    }
    onCreate(compito)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(false)))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crea compito</DialogTitle>
          <DialogDescription>
            Aggiungi un nuovo compito assegnandolo a un proprietario e una
            scadenza.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-oggetto">Oggetto</Label>
            <Input
              id="c-oggetto"
              value={oggetto}
              onChange={(e) => setOggetto(e.target.value)}
              placeholder="Es. Richiamare per conferma sopralluogo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Stato</Label>
              <Select value={stato} onValueChange={(v) => setStato(v as StatoCompito)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATO_COMPITO_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priorità</Label>
              <Select
                value={priorita}
                onValueChange={(v) => setPriorita(v as PrioritaCompito)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIORITA_COMPITO_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-scadenza">Data di scadenza</Label>
              <Input
                id="c-scadenza"
                type="date"
                value={scadenza}
                onChange={(e) => setScadenza(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sede</Label>
              <Select value={sede} onValueChange={(v) => setSede(v as SedeLabel)}>
                <SelectTrigger className="w-full">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Proprietario del compito</Label>
            <Select
              value={proprietario}
              onValueChange={(v) => setProprietario(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockProprietariCompito.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-descrizione">Descrizione</Label>
            <Textarea
              id="c-descrizione"
              rows={3}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Dettagli del compito…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!oggetto.trim() || !scadenza}
            onClick={submit}
          >
            Crea Compito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
