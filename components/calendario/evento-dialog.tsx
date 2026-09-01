"use client"

import { useEffect, useRef, useState } from "react"
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
  CorrelatoPicker,
  type CorrelatoValue,
} from "@/components/shared/correlato-picker"
import { toDatetimeLocal, fromDatetimeLocal } from "@/lib/calendario/date-utils"
import {
  COLORE_FALLBACK,
  categoriaDi,
  type CategoriaCalendario,
  type EventoCalendario,
  type EventoCorrelatoTipo,
} from "@/lib/calendario/types"

const CORRELATO_TIPI: EventoCorrelatoTipo[] = ["lead", "cliente", "installatore"]

function correlatoDaEvento(evento: EventoCalendario | undefined): CorrelatoValue | null {
  if (!evento?.correlato_tipo) return null
  const id =
    evento.correlato_tipo === "lead"
      ? evento.lead_id
      : evento.correlato_tipo === "cliente"
        ? evento.cliente_id
        : evento.installatore_id
  if (!id) return null
  return { tipo: evento.correlato_tipo, id, nome: evento.correlato_nome ?? "" }
}

/** I tre id di collegamento, con il solo tipo scelto valorizzato. */
function correlatoPayload(correlato: CorrelatoValue | null) {
  return {
    lead_id: correlato?.tipo === "lead" ? correlato.id : null,
    cliente_id: correlato?.tipo === "cliente" ? correlato.id : null,
    installatore_id: correlato?.tipo === "installatore" ? correlato.id : null,
  }
}

export function EventoDialog({
  open,
  onOpenChange,
  categorie,
  evento,
  /** Giorno pre-selezionato quando si crea cliccando una cella. */
  giornoIniziale,
  /** Collegamento fisso: apertura dalla scheda di un record. */
  correlatoFisso,
  onSaved,
  onDeleted,
  /** false in sola lettura: evento di un altro utente. */
  modificabile = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorie: CategoriaCalendario[]
  evento?: EventoCalendario
  giornoIniziale?: Date
  correlatoFisso?: CorrelatoValue
  onSaved: (evento: EventoCalendario) => void
  onDeleted?: (id: string) => void
  modificabile?: boolean
}) {
  const isEdit = Boolean(evento)
  const [titolo, setTitolo] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [coloreCustom, setColoreCustom] = useState<string | null>(null)
  const [inizio, setInizio] = useState("")
  const [fine, setFine] = useState("")
  const [note, setNote] = useState("")
  const [correlato, setCorrelato] = useState<CorrelatoValue | null>(null)
  const [saving, setSaving] = useState(false)

  const wasOpen = useRef(false)
  useEffect(() => {
    if (!open || wasOpen.current) {
      wasOpen.current = open
      return
    }
    wasOpen.current = open

    if (evento) {
      setTitolo(evento.titolo)
      setCategoriaId(evento.categoria_id)
      setColoreCustom(evento.colore)
      setInizio(toDatetimeLocal(new Date(evento.inizio)))
      setFine(evento.fine ? toDatetimeLocal(new Date(evento.fine)) : "")
      setNote(evento.note ?? "")
      setCorrelato(correlatoFisso ?? correlatoDaEvento(evento))
      return
    }

    // Nuovo evento: il giorno cliccato alle 9:00, che e' l'ora piu'
    // probabile per un appuntamento e risparmia un'interazione.
    const base = giornoIniziale ? new Date(giornoIniziale) : new Date()
    if (giornoIniziale) base.setHours(9, 0, 0, 0)
    setTitolo("")
    setCategoriaId(categorie[0]?.id ?? "")
    setColoreCustom(null)
    setInizio(toDatetimeLocal(base))
    setFine("")
    setNote("")
    setCorrelato(correlatoFisso ?? null)
  }, [open, evento, giornoIniziale, correlatoFisso, categorie])

  // Nelle schede Lead/Cliente/Installatore le categorie arrivano da una
  // fetch: se il dialog si apre prima che risponda, `categoriaId` resta
  // vuoto e il form non sarebbe salvabile. Qui si aggancia la prima
  // categoria appena la lista esiste, ma solo su un evento nuovo — su
  // uno esistente sovrascriverebbe la categoria scelta a suo tempo.
  useEffect(() => {
    if (!open || isEdit || categoriaId || categorie.length === 0) return
    setCategoriaId(categorie[0].id)
  }, [open, isEdit, categoriaId, categorie])

  const categoriaScelta = categoriaId
    ? categoriaDi({ categoria_id: categoriaId }, categorie)
    : null
  const coloreEffettivo = coloreCustom ?? categoriaScelta?.colore ?? COLORE_FALLBACK
  const valido = titolo.trim() !== "" && categoriaId !== "" && inizio !== ""

  const salva = async () => {
    if (!valido || saving) return
    const inizioIso = fromDatetimeLocal(inizio)
    if (!inizioIso) {
      toast.error("Data di inizio non valida")
      return
    }
    const fineIso = fine ? fromDatetimeLocal(fine) : null
    if (fine && !fineIso) {
      toast.error("Data di fine non valida")
      return
    }
    if (fineIso && new Date(fineIso) < new Date(inizioIso)) {
      toast.error("La fine dell'evento precede l'inizio")
      return
    }

    setSaving(true)
    const payload = {
      titolo: titolo.trim(),
      categoria_id: categoriaId,
      colore: coloreCustom,
      inizio: inizioIso,
      fine: fineIso,
      note: note.trim() || null,
      ...correlatoPayload(correlato),
    }

    try {
      const res = await fetch(
        isEdit ? `/api/calendario/eventi/${evento!.id}` : "/api/calendario/eventi",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        const errore = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errore?.error ?? "Salvataggio non riuscito")
      }
      onSaved((await res.json()) as EventoCalendario)
      toast.success(isEdit ? "Evento aggiornato" : "Evento creato")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nel salvataggio")
    } finally {
      setSaving(false)
    }
  }

  const elimina = async () => {
    if (!evento || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/calendario/eventi/${evento.id}`, { method: "DELETE" })
      if (!res.ok) {
        const errore = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errore?.error ?? "Eliminazione non riuscita")
      }
      onDeleted?.(evento.id)
      toast.success("Evento eliminato")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore nell'eliminazione")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {!modificabile ? "Dettaglio evento" : isEdit ? "Modifica evento" : "Nuovo evento"}
          </DialogTitle>
          <DialogDescription>
            {!modificabile
              ? evento?.origine === "tidycal"
                ? "Prenotazione sincronizzata da TidyCal. Modificala o cancellala dalla piattaforma TidyCal."
                : `Evento creato da ${evento?.creato_da_nome ?? "un altro utente"}: puoi solo consultarlo.`
              : "Gli eventi del calendario sono manuali e indipendenti da compiti e scadenze."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-titolo">
              Titolo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="evento-titolo"
              value={titolo}
              disabled={!modificabile}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es. Sopralluogo Rossi"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Select
                value={categoriaId}
                disabled={!modificabile}
                onValueChange={(v) => setCategoriaId(String(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categorie.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: categoria.colore }}
                          />
                          {categoria.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-colore">Colore</Label>
              <div className="flex items-center gap-2">
                <input
                  id="evento-colore"
                  type="color"
                  value={coloreEffettivo}
                  disabled={!modificabile}
                  onChange={(e) => setColoreCustom(e.target.value.toLowerCase())}
                  className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Colore dell'evento"
                />
                {coloreCustom ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!modificabile}
                    onClick={() => setColoreCustom(null)}
                  >
                    Usa quello della categoria
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Ereditato da {categoriaScelta?.nome ?? "categoria"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-inizio">
                Inizio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="evento-inizio"
                type="datetime-local"
                value={inizio}
                disabled={!modificabile}
                onChange={(e) => setInizio(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="evento-fine">Fine</Label>
              <Input
                id="evento-fine"
                type="datetime-local"
                value={fine}
                disabled={!modificabile}
                onChange={(e) => setFine(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Record collegato</Label>
            <CorrelatoPicker
              value={correlato}
              onSelect={setCorrelato}
              locked={Boolean(correlatoFisso) || !modificabile}
              disabled={!modificabile}
              allowedTipi={CORRELATO_TIPI}
              endpoint="/api/calendario/correlabili"
              placeholder="Cerca lead, cliente o installatore…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-note">Note</Label>
            <Textarea
              id="evento-note"
              value={note}
              disabled={!modificabile}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Dettagli, indirizzo, promemoria…"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit && modificabile && onDeleted ? (
            <Button variant="ghost" className="text-destructive" disabled={saving} onClick={elimina}>
              Elimina
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {modificabile ? "Annulla" : "Chiudi"}
            </Button>
            {modificabile ? (
              <Button disabled={!valido || saving} onClick={salva}>
                {isEdit ? "Salva" : "Crea evento"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
