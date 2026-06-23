"use client"

import { useEffect, useState } from "react"
import { IconCalendarEvent, IconUpload } from "@tabler/icons-react"
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
import { type Scadenza, mockProprietariScadenza } from "@/lib/mock-data"
import { ScadenzaAvatar } from "./scadenza-utils"

/** "DD/MM/YYYY HH:MM" → input value { date: "YYYY-MM-DD", time: "HH:MM" } */
function toInputs(dt: string): { date: string; time: string } {
  if (!dt) return { date: "", time: "" }
  const [datePart, timePart = ""] = dt.split(" ")
  const [d, m, y] = datePart.split("/")
  if (!d || !m || !y) return { date: "", time: timePart }
  return { date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, time: timePart }
}

/** date "YYYY-MM-DD" + time "HH:MM" → "DD/MM/YYYY HH:MM" */
function toStored(date: string, time: string): string {
  if (!date) return ""
  const [y, m, d] = date.split("-")
  const t = time || "09:00"
  return `${d}/${m}/${y} ${t}`
}

function stampNow(): string {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`
}

export function ScadenzaFormDialog({
  open,
  onOpenChange,
  onSave,
  scadenza,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSave: (scadenza: Scadenza, keepOpen: boolean) => void
  /** se presente, il dialog è in modalità modifica */
  scadenza?: Scadenza | null
}) {
  const isEdit = Boolean(scadenza)
  const [nome, setNome] = useState("")
  const [proprietario, setProprietario] = useState(mockProprietariScadenza[0])
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [file, setFile] = useState<string | null>(null)
  const [descrizione, setDescrizione] = useState("")

  useEffect(() => {
    if (open) {
      if (scadenza) {
        const { date: d, time: t } = toInputs(scadenza["Data scadenza"])
        setNome(scadenza["Nome Scadenze"])
        setProprietario(scadenza["Proprietario di Scadenze"])
        setDate(d)
        setTime(t)
        setFile(scadenza["Caricamento file 1"])
        setDescrizione(scadenza.Descrizione ?? "")
      } else {
        setNome("")
        setProprietario(mockProprietariScadenza[0])
        setDate("")
        setTime("")
        setFile(null)
        setDescrizione("")
      }
    }
  }, [open, scadenza])

  const build = (): Scadenza => {
    const now = stampNow()
    return {
      id: scadenza?.id ?? `scad-${Date.now()}`,
      "Nome Scadenze": nome.trim(),
      "Data scadenza": toStored(date, time),
      "Proprietario di Scadenze": proprietario,
      "Ora modifica": now,
      "Ora creazione": scadenza?.["Ora creazione"] ?? now,
      "Ora ultima attività": now,
      "Connesso a": scadenza?.["Connesso a"] ?? null,
      Descrizione: descrizione.trim() || null,
      "Caricamento file 1": file,
      Tag: scadenza?.Tag ?? [],
      "Modalità iscrizione annullata":
        scadenza?.["Modalità iscrizione annullata"] ?? null,
      "Ora iscrizione annullata":
        scadenza?.["Ora iscrizione annullata"] ?? null,
      Note: scadenza?.Note ?? [],
    }
  }

  const valid = nome.trim() !== "" && date !== ""

  const submit = (keepOpen: boolean) => {
    if (!valid) return
    onSave(build(), keepOpen)
    if (!keepOpen) onOpenChange(false)
    else {
      setNome("")
      setDate("")
      setTime("")
      setFile(null)
      setDescrizione("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifica Scadenze" : "Crea Scadenze"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Aggiorna le informazioni della scadenza."
              : "Aggiungi una nuova scadenza con proprietario e data."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          {/* Immagine Scadenze */}
          <section className="flex items-center gap-3">
            <ScadenzaAvatar nome={nome || "Scadenza"} size={56} />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Immagine Scadenze
              </span>
              <button
                type="button"
                className="self-start text-xs font-medium text-info hover:underline"
              >
                Carica immagine
              </button>
            </div>
          </section>

          {/* Informazioni su Scadenze */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Informazioni su Scadenze
            </h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-nome">
                Nome Scadenze <span className="text-destructive">*</span>
              </Label>
              <Input
                id="s-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Inviare pratica PNRR40%"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Proprietario di Scadenze</Label>
              <Select
                value={proprietario}
                onValueChange={(v) => setProprietario(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {mockProprietariScadenza.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-date">
                  Data scadenza <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <IconCalendarEvent
                    size={16}
                    stroke={1.8}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="s-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-time">Ora</Label>
                <Input
                  id="s-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-file">Caricamento file 1</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => setFile(file ? null : "documento.pdf")}
                >
                  <IconUpload size={15} stroke={1.8} data-icon="inline-start" />
                  {file ? "Rimuovi file" : "Carica file"}
                </Button>
                <span className="truncate text-sm text-muted-foreground">
                  {file ?? "Nessun file selezionato"}
                </span>
              </div>
            </div>
          </section>

          {/* Nuova sezione 1 */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nuova sezione 1
            </h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-descrizione">Descrizione</Label>
              <Textarea
                id="s-descrizione"
                rows={3}
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                placeholder="Dettagli della scadenza…"
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          {!isEdit && (
            <Button
              variant="outline"
              disabled={!valid}
              onClick={() => submit(true)}
            >
              Salva e nuovo
            </Button>
          )}
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!valid}
            onClick={() => submit(false)}
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
