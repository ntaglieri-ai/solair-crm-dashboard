"use client"

// Scelta di formato e colonne prima di un export, condivisa da Clienti, Lead
// e Installatori.
//
// Perche' esiste: l'export scriveva sempre TUTTE le colonne del modulo, in
// CSV, senza chiedere nulla. Su Clienti sono 170 colonne — un file che nessuno
// apre volentieri e in cui le tre colonne che servivano davvero stanno in
// mezzo alle altre. Il default qui e' "le colonne che hai a schermo", perche'
// e' gia' la selezione che l'utente ha fatto lavorando; "tutte" resta a un
// clic, perche' e' il comportamento di prima e qualcuno ci fa affidamento.

import { useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { ColonnaExport, FormatoExport } from "@/lib/export/file"

export interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Titolo dell'ambito: "42 clienti selezionati", "Tutti i lead filtrati". */
  descrizioneAmbito: string
  /** Tutte le colonne esportabili del modulo, nell'ordine del modulo. */
  colonneDisponibili: ColonnaExport[]
  /** Id delle colonne attive a schermo: sono la preselezione. */
  colonneAttive: string[]
  inCorso?: boolean
  onConferma: (formato: FormatoExport, colonne: ColonnaExport[]) => void
}

export function ExportDialog({
  open,
  onOpenChange,
  descrizioneAmbito,
  colonneDisponibili,
  colonneAttive,
  inCorso = false,
  onConferma,
}: ExportDialogProps) {
  const [formato, setFormato] = useState<FormatoExport>("csv")
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set())

  // Le colonne attive cambiano mentre il dialog e' chiuso (l'utente ne
  // aggiunge una e poi esporta): la preselezione si ricalcola a ogni
  // apertura, non una volta sola al mount.
  useEffect(() => {
    if (!open) return
    const attiveEsportabili = colonneAttive.filter((id) =>
      colonneDisponibili.some((c) => c.id === id),
    )
    setSelezionate(
      new Set(
        attiveEsportabili.length > 0
          ? attiveEsportabili
          : colonneDisponibili.map((c) => c.id),
      ),
    )
  }, [open, colonneAttive, colonneDisponibili])

  const colonneScelte = useMemo(
    () => colonneDisponibili.filter((c) => selezionate.has(c.id)),
    [colonneDisponibili, selezionate],
  )

  const toggle = (id: string) => {
    setSelezionate((precedenti) => {
      const successive = new Set(precedenti)
      if (successive.has(id)) successive.delete(id)
      else successive.add(id)
      return successive
    })
  }

  const tutte = () => setSelezionate(new Set(colonneDisponibili.map((c) => c.id)))
  const soloAttive = () =>
    setSelezionate(
      new Set(colonneAttive.filter((id) => colonneDisponibili.some((c) => c.id === id))),
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Esporta</DialogTitle>
          <DialogDescription>{descrizioneAmbito}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Formato
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formato === "csv" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormato("csv")}
              >
                CSV
              </Button>
              <Button
                type="button"
                variant={formato === "xlsx" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setFormato("xlsx")}
              >
                Excel
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Colonne ({colonneScelte.length} di {colonneDisponibili.length})
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={soloAttive}>
                  Solo quelle a schermo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={tutte}>
                  Tutte
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-2">
              {colonneDisponibili.map((colonna) => (
                <label
                  key={colonna.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-muted"
                >
                  <Checkbox
                    checked={selezionate.has(colonna.id)}
                    onCheckedChange={() => toggle(colonna.id)}
                  />
                  <span className="truncate">{colonna.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            // Un export senza colonne produrrebbe un file di sole righe vuote:
            // si blocca qui invece di scaricarlo.
            disabled={colonneScelte.length === 0 || inCorso}
            onClick={() => onConferma(formato, colonneScelte)}
          >
            {inCorso ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Esporta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
