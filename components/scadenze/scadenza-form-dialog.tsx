"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconCalendarEvent } from "@tabler/icons-react"
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
import { useScadenzeReferenceData } from "@/lib/scadenze/hooks"
import type { ScadenzaRecord } from "@/lib/scadenze/repository"
import {
  CorrelatoPicker,
  type CorrelatoValue,
} from "@/components/shared/correlato-picker"
import { ScadenzaTagField } from "./scadenza-tag-picker"

/** ISO → { date: "YYYY-MM-DD", time: "HH:MM" } per gli input nativi. */
function toInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: "", time: "" }
  const p = (n: number) => String(n).padStart(2, "0")
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

/** date "YYYY-MM-DD" + time "HH:MM" → ISO (locale del browser). */
function toIso(date: string, time: string): string | null {
  if (!date) return null
  const t = time || "09:00"
  const d = new Date(`${date}T${t}:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function correlatoValueFromScadenza(
  scadenza?: ScadenzaRecord,
): CorrelatoValue | null {
  if (!scadenza?.connesso_a_id || !scadenza.connesso_a_tipo) return null
  return {
    tipo: scadenza.connesso_a_tipo,
    id: scadenza.connesso_a_id,
    // Il nome del record collegato non è tracciato su scadenze: mostriamo
    // l'id come segnaposto finché l'utente non riseleziona.
    nome: scadenza.connesso_a_id,
  }
}

export function ScadenzaFormDialog({
  open,
  onOpenChange,
  scadenza,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se presente, il dialog lavora in modalità modifica su questa scadenza. */
  scadenza?: ScadenzaRecord
  /** Callback di creazione — richiesto solo in modalità creazione. */
  onCreated?: (scadenza: ScadenzaRecord) => void
}) {
  const router = useRouter()
  const { data: referenceData } = useScadenzeReferenceData()
  const proprietari = useMemo(
    () => referenceData?.proprietari ?? [],
    [referenceData],
  )
  const tagSuggestions = referenceData?.tags ?? []
  const isEdit = Boolean(scadenza)

  const [nome, setNome] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [proprietarioId, setProprietarioId] = useState("")
  const [descrizione, setDescrizione] = useState("")
  const [tag, setTag] = useState("")
  const [correlato, setCorrelato] = useState<CorrelatoValue | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setNome("")
    setDate("")
    setTime("")
    setProprietarioId("")
    setDescrizione("")
    setTag("")
    setCorrelato(null)
  }

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (scadenza) {
        const { date: d, time: t } = toInputs(scadenza.data_scadenza)
        setNome(scadenza.nome)
        setDate(d)
        setTime(t)
        setProprietarioId(scadenza.proprietario_id ?? "")
        setDescrizione(scadenza.descrizione ?? "")
        setTag(scadenza.tag ?? "")
        setCorrelato(correlatoValueFromScadenza(scadenza))
      } else {
        reset()
      }
    }
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scadenza])

  const valid = nome.trim() !== "" && date !== ""

  const submit = async () => {
    if (!valid || submitting) return
    const dataScadenza = toIso(date, time)
    if (!dataScadenza) return

    setSubmitting(true)
    try {
      if (isEdit && scadenza) {
        const res = await fetch(`/api/scadenze/${scadenza.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            data_scadenza: dataScadenza,
            proprietario_id: proprietarioId || null,
            descrizione: descrizione.trim() || null,
            connesso_a_id: correlato?.id ?? null,
            connesso_a_tipo:
              correlato?.tipo === "lead" || correlato?.tipo === "cliente"
                ? correlato.tipo
                : null,
            tag: tag.trim() || null,
          }),
        })
        if (!res.ok) throw new Error("Aggiornamento non riuscito")
        toast.success("Scadenza aggiornata", { description: nome.trim() })
        onOpenChange(false)
        router.refresh()
      } else {
        const res = await fetch("/api/scadenze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            data_scadenza: dataScadenza,
            proprietario_id: proprietarioId || null,
            descrizione: descrizione.trim() || null,
            connesso_a_id: correlato?.id ?? null,
            connesso_a_tipo:
              correlato?.tipo === "lead" || correlato?.tipo === "cliente"
                ? correlato.tipo
                : null,
            tag: tag.trim() || null,
          }),
        })
        if (!res.ok) throw new Error("Creazione non riuscita")
        const created = (await res.json()) as ScadenzaRecord
        toast.success("Scadenza creata", { description: nome.trim() })
        onCreated?.(created)
        reset()
        onOpenChange(false)
        router.refresh()
      }
    } catch {
      toast.error(
        isEdit ? "Errore nell'aggiornamento della scadenza" : "Errore nella creazione della scadenza",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return onOpenChange(o)
        if (!isEdit) reset()
        onOpenChange(false)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica scadenza" : "Crea scadenza"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Aggiorna i dettagli della scadenza."
              : "Aggiungi una nuova scadenza assegnandole un proprietario e una data."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="s-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Inviare pratica PNRR40%"
            />
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
            <Label>Proprietario</Label>
            <Select
              items={Object.fromEntries(proprietari.map((p) => [p.id, p.nome]))}
              value={proprietarioId}
              onValueChange={(v) => setProprietarioId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona proprietario" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {proprietari.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Connesso a</Label>
            <CorrelatoPicker
              value={correlato}
              onSelect={setCorrelato}
              allowedTipi={["lead", "cliente"]}
              placeholder="Cerca lead o cliente…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tag</Label>
            <ScadenzaTagField value={tag} onChange={setTag} suggestions={tagSuggestions} />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!valid || submitting}
            onClick={submit}
          >
            {isEdit ? "Salva modifiche" : "Crea scadenza"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
