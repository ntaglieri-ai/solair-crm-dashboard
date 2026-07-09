"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type Compito, type PrioritaCompito, PRIORITA_COMPITO_ORDER } from "@/lib/mock-data"
import { useCompitiReferenceData, useCreateCompito } from "@/lib/compiti/hooks"
import { CorrelatoPicker, type CorrelatoValue } from "@/components/shared/correlato-picker"
import { correlatoTipoLabel } from "./compito-utils"
import { formatDMY } from "./new-compito-dialog"

/**
 * Dialog di creazione rapida condiviso da Lead, Cliente e Scadenza: stesso
 * payload di CompitoFormDialog ma con "Correlato a" bloccato sul record da
 * cui si apre e senza i campi Stato/Sede/Descrizione, non richiesti dal
 * flusso "+ Compito" delle sezioni Attività.
 */
export function QuickCompitoDialog({
  open,
  onOpenChange,
  correlato,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  correlato: CorrelatoValue
  onCreated: (compito: Compito) => void
}) {
  const { data: referenceData } = useCompitiReferenceData()
  const proprietari = referenceData?.proprietari ?? []
  const createCompito = useCreateCompito()

  const [oggetto, setOggetto] = useState("")
  const [scadenza, setScadenza] = useState("")
  const [priorita, setPriorita] = useState<PrioritaCompito>("Medio")
  const [proprietarioId, setProprietarioId] = useState("")

  const proprietario =
    proprietari.find((p) => p.id === proprietarioId) ?? proprietari[0] ?? null

  const reset = () => {
    setOggetto("")
    setScadenza("")
    setPriorita("Medio")
    setProprietarioId("")
  }

  const submit = () => {
    if (!oggetto.trim() || !scadenza || !proprietario) return
    const compito: Partial<Compito> = {
      Oggetto: oggetto.trim(),
      Stato: "Non iniziato",
      Priorità: priorita,
      "Data di scadenza": formatDMY(scadenza),
      "Proprietario del compito": proprietario.nome,
      "Proprietario del compito.id": proprietario.zoho_id,
      "Correlato a": {
        tipo: correlatoTipoLabel(correlato.tipo),
        id: correlato.id,
        nome: correlato.nome,
        linkable: true,
      },
      Descrizione: "",
    }
    createCompito.mutate(compito, {
      onSuccess: (created) => {
        toast.success("Compito creato", { description: oggetto.trim() })
        onCreated(created)
        reset()
        onOpenChange(false)
      },
      onError: () => toast.error("Errore nella creazione del compito"),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo compito</DialogTitle>
          <DialogDescription>
            Il compito verrà collegato automaticamente a {correlato.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Correlato a</Label>
            <CorrelatoPicker value={correlato} onSelect={() => {}} locked />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qc-oggetto">Oggetto</Label>
            <Input
              id="qc-oggetto"
              value={oggetto}
              onChange={(e) => setOggetto(e.target.value)}
              placeholder="Es. Richiamare per conferma"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-scadenza">Data di scadenza</Label>
              <Input
                id="qc-scadenza"
                type="date"
                value={scadenza}
                onChange={(e) => setScadenza(e.target.value)}
              />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={
              !oggetto.trim() || !scadenza || !proprietario || createCompito.isPending
            }
            onClick={submit}
          >
            Crea Compito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
