"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
} from "@/lib/mock-data"
import { useCompitiReferenceData, useUpdateCompito } from "@/lib/compiti/hooks"
import {
  CorrelatoPicker,
  type CorrelatoTipo,
  type CorrelatoValue,
} from "@/components/shared/correlato-picker"
import { correlatoTipoLabel } from "./compito-utils"

function correlatoValueFromCompito(compito?: Compito): CorrelatoValue | null {
  const correlato = compito?.["Correlato a"]
  if (!correlato) return null
  return {
    tipo: correlato.tipo.toLowerCase() as CorrelatoTipo,
    id: correlato.id,
    nome: correlato.nome,
  }
}

export function formatDMY(iso: string): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

// Inverso di formatDMY: "dd/mm/yyyy" → "yyyy-mm-dd" per l'input type=date.
function dmyToInputValue(dmy: string): string {
  if (!dmy) return ""
  const [d, m, y] = dmy.split("/")
  if (!d || !m || !y) return ""
  return `${y}-${m}-${d}`
}

function stampNow(): string {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`
}

// Form compito in due modalità: creazione (onCreate) e modifica (compito).
// In modifica invia una PATCH con i soli campi cambiati e fa router.refresh().
export function CompitoFormDialog({
  open,
  onOpenChange,
  compito,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Se presente, il dialog lavora in modalità modifica su questo compito. */
  compito?: Compito
  /** Callback di creazione — richiesto solo in modalità creazione. */
  onCreate?: (compito: Compito) => void
}) {
  const router = useRouter()
  const { data: referenceData } = useCompitiReferenceData()
  const proprietari = useMemo(
    () => referenceData?.proprietari ?? [],
    [referenceData],
  )
  const updateCompito = useUpdateCompito()
  const isEdit = !!compito

  const [oggetto, setOggetto] = useState("")
  const [stato, setStato] = useState<StatoCompito>("Non iniziato")
  const [priorita, setPriorita] = useState<PrioritaCompito>("Medio")
  const [scadenza, setScadenza] = useState("")
  const [proprietarioId, setProprietarioId] = useState("")
  const [sede, setSede] = useState<SedeLabel>(SEDE_LABELS[0])
  const [descrizione, setDescrizione] = useState("")
  const [correlato, setCorrelato] = useState<CorrelatoValue | null>(null)

  // In modifica il fallback è il proprietario attuale del compito (i
  // riferimenti arrivano in async): finché l'utente non riseleziona, la PATCH
  // non cambia mai l'assegnatario. In creazione il fallback è il primo utente.
  const proprietario =
    proprietari.find((p) => p.id === proprietarioId) ??
    (isEdit
      ? (proprietari.find(
          (p) => p.zoho_id === compito["Proprietario del compito.id"],
        ) ?? null)
      : (proprietari[0] ?? null))

  const reset = () => {
    setOggetto("")
    setStato("Non iniziato")
    setPriorita("Medio")
    setScadenza("")
    setProprietarioId("")
    setSede(SEDE_LABELS[0])
    setDescrizione("")
    setCorrelato(null)
  }

  // Precompila i campi ad ogni apertura in modalità modifica.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current && compito) {
      setOggetto(compito.Oggetto)
      setStato(compito.Stato)
      setPriorita(compito.Priorità)
      setScadenza(dmyToInputValue(compito["Data di scadenza"]))
      setSede(compito.Sede)
      setDescrizione(compito.Descrizione)
      setProprietarioId("")
      setCorrelato(correlatoValueFromCompito(compito))
    }
    wasOpen.current = open
  }, [open, compito])

  const submitCreate = () => {
    if (!oggetto.trim() || !scadenza || !proprietario || !onCreate) return
    const nuovo: Compito = {
      id: `task-${Date.now()}`,
      Oggetto: oggetto.trim(),
      Stato: stato,
      Priorità: priorita,
      "Data di scadenza": formatDMY(scadenza),
      "Proprietario del compito": proprietario.nome,
      "Proprietario del compito.id": proprietario.zoho_id,
      Sede: sede,
      "Correlato a": correlato
        ? {
            tipo: correlatoTipoLabel(correlato.tipo),
            id: correlato.id,
            nome: correlato.nome,
            linkable: true,
          }
        : null,
      Descrizione: descrizione.trim(),
      Promemoria: null,
      "Data di creazione": stampNow(),
      "Orario di chiusura": null,
      Note: [],
    }
    onCreate(nuovo)
    reset()
    onOpenChange(false)
  }

  const submitEdit = () => {
    if (!compito || !oggetto.trim() || !scadenza) return
    const patch: Partial<Compito> = {}
    if (oggetto.trim() !== compito.Oggetto) patch.Oggetto = oggetto.trim()
    if (stato !== compito.Stato) patch.Stato = stato
    if (priorita !== compito.Priorità) patch.Priorità = priorita
    const scadenzaDMY = formatDMY(scadenza)
    if (scadenzaDMY && scadenzaDMY !== compito["Data di scadenza"])
      patch["Data di scadenza"] = scadenzaDMY
    if (
      proprietario &&
      proprietario.zoho_id !== compito["Proprietario del compito.id"]
    ) {
      patch["Proprietario del compito"] = proprietario.nome
      patch["Proprietario del compito.id"] = proprietario.zoho_id
    }
    if (sede !== compito.Sede) patch.Sede = sede
    if (descrizione.trim() !== compito.Descrizione)
      patch.Descrizione = descrizione.trim()
    const originalCorrelato = correlatoValueFromCompito(compito)
    const correlatoChanged =
      (correlato?.id ?? null) !== (originalCorrelato?.id ?? null) ||
      (correlato?.tipo ?? null) !== (originalCorrelato?.tipo ?? null)
    if (correlatoChanged) {
      patch["Correlato a"] = correlato
        ? {
            tipo: correlatoTipoLabel(correlato.tipo),
            id: correlato.id,
            nome: correlato.nome,
            linkable: true,
          }
        : null
    }

    if (Object.keys(patch).length === 0) {
      onOpenChange(false)
      return
    }
    updateCompito.mutate(
      { id: compito.id, patch },
      {
        onSuccess: () => {
          toast.success("Compito aggiornato", { description: oggetto.trim() })
          onOpenChange(false)
          router.refresh()
        },
        onError: () => toast.error("Errore nell'aggiornamento del compito"),
      },
    )
  }

  const submitDisabled =
    !oggetto.trim() ||
    !scadenza ||
    (isEdit ? updateCompito.isPending : !proprietario)

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
          <DialogTitle>{isEdit ? "Modifica compito" : "Crea compito"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Aggiorna i dettagli del compito. Vengono salvati solo i campi modificati."
              : "Aggiungi un nuovo compito assegnandolo a un proprietario e una scadenza."}
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
              items={Object.fromEntries(proprietari.map((p) => [p.id, p.nome]))}
              value={proprietario?.id ?? ""}
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
            <Label>Correlato a</Label>
            <CorrelatoPicker value={correlato} onSelect={setCorrelato} />
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
            disabled={submitDisabled}
            onClick={isEdit ? submitEdit : submitCreate}
          >
            {isEdit ? "Salva modifiche" : "Crea Compito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Wrapper di creazione: mantiene l'API dei call-site esistenti.
export function NewCompitoDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreate: (compito: Compito) => void
}) {
  return (
    <CompitoFormDialog open={open} onOpenChange={onOpenChange} onCreate={onCreate} />
  )
}
