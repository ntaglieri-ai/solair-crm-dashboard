"use client"

// Scelta di formato e colonne prima di un export, condivisa da Clienti, Lead
// e Installatori.
//
// Perche' esiste: l'export scriveva sempre TUTTE le colonne del modulo, in
// CSV, senza chiedere nulla. Su Clienti sono oltre 160 — un file che nessuno
// apre volentieri e in cui le tre colonne che servivano davvero stanno in
// mezzo alle altre. Il default e' "le colonne che hai a schermo", perche' e'
// gia' la selezione che l'utente ha fatto lavorando; "tutte" resta a un clic,
// perche' e' il comportamento di prima e qualcuno ci fa affidamento.
//
// Con quei numeri la ricerca non e' un vezzo: senza, trovare "Codice fiscale"
// significa scorrere un elenco di 161 voci.

import { useEffect, useMemo, useState } from "react"
import { Download, Loader2, Search, X } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ColonnaExport, FormatoExport } from "@/lib/export/file"

export interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ambito dell'export: "100 clienti selezionati", "722 clienti filtrati". */
  descrizioneAmbito: string
  /** Tutte le colonne esportabili del modulo, nell'ordine del modulo. */
  colonneDisponibili: ColonnaExport[]
  /** Id delle colonne attive a schermo: sono la preselezione. */
  colonneAttive: string[]
  inCorso?: boolean
  onConferma: (formato: FormatoExport, colonne: ColonnaExport[]) => void
}

const FORMATI: { id: FormatoExport; nome: string; nota: string }[] = [
  { id: "csv", nome: "CSV", nota: "Universale, si apre ovunque" },
  { id: "xlsx", nome: "Excel", nota: "Intestazioni in grassetto" },
]

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
  const [ricerca, setRicerca] = useState("")

  const attiveEsportabili = useMemo(
    () => colonneAttive.filter((id) => colonneDisponibili.some((c) => c.id === id)),
    [colonneAttive, colonneDisponibili],
  )

  // Le colonne attive cambiano mentre il dialog e' chiuso (l'utente ne
  // aggiunge una e poi esporta): la preselezione si ricalcola a ogni
  // apertura, non una volta sola al mount. Si azzera anche la ricerca, cosi'
  // la riapertura non parte filtrata da ieri.
  useEffect(() => {
    if (!open) return
    setRicerca("")
    setSelezionate(
      new Set(
        attiveEsportabili.length > 0
          ? attiveEsportabili
          : colonneDisponibili.map((c) => c.id),
      ),
    )
  }, [open, attiveEsportabili, colonneDisponibili])

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase()
    if (!q) return colonneDisponibili
    return colonneDisponibili.filter((c) => c.label.toLowerCase().includes(q))
  }, [colonneDisponibili, ricerca])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Esporta</DialogTitle>
          <DialogDescription>{descrizioneAmbito}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 py-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Formato
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORMATI.map((f) => {
                const attivo = formato === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormato(f.id)}
                    aria-pressed={attivo}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                      attivo
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">{f.nome}</span>
                    <span className="text-[11px] text-muted-foreground">{f.nota}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Colonne
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {colonneScelte.length} di {colonneDisponibili.length}
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca colonna…"
                  className="h-8 pl-8 pr-8 text-sm"
                />
                {ricerca ? (
                  <button
                    type="button"
                    onClick={() => setRicerca("")}
                    aria-label="Pulisci ricerca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                disabled={attiveEsportabili.length === 0}
                onClick={() => setSelezionate(new Set(attiveEsportabili))}
              >
                A schermo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setSelezionate(new Set(colonneDisponibili.map((c) => c.id)))}
              >
                Tutte
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
              {visibili.length === 0 ? (
                <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                  Nessuna colonna corrisponde a “{ricerca}”.
                </p>
              ) : (
                visibili.map((colonna) => (
                  <label
                    key={colonna.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-3 py-2 text-[13px] last:border-b-0 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selezionate.has(colonna.id)}
                      onCheckedChange={() => toggle(colonna.id)}
                    />
                    <span className="truncate">{colonna.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
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
            Esporta {colonneScelte.length > 0 ? `(${colonneScelte.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
