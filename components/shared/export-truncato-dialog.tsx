"use client"

// Avviso mostrato PRIMA del download quando l'export non contiene tutte le
// righe che il filtro seleziona.
//
// Perche' esiste: fino al 23/08/2026 l'export CSV si fermava a 200 righe e non
// lo diceva a nessuno. Chi esportava "tutti i lead di Palermo" si portava a
// casa un file che sembrava completo e non lo era — il modo peggiore di
// sbagliare, perche' l'errore non e' visibile nel risultato. Il tetto adesso e'
// molto piu' alto, ma finche' un tetto esiste il troncamento va dichiarato con
// il numero esatto di righe che mancano, e la conferma deve essere un gesto
// esplicito dell'utente.

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ExportTruncatoInfo {
  /** Righe che finirebbero nel CSV. */
  esportate: number
  /** Righe che il filtro seleziona davvero. */
  totali: number
  /** Tetto massimo per singolo export, lato server. */
  limite: number
  /** "lead" / "clienti": entra nel testo, minuscolo. */
  entita: string
}

interface ExportTruncatoDialogProps {
  info: ExportTruncatoInfo | null
  onCancel: () => void
  onConfirm: () => void
}

export function ExportTruncatoDialog({
  info,
  onCancel,
  onConfirm,
}: ExportTruncatoDialogProps) {
  const mancanti = info ? info.totali - info.esportate : 0

  return (
    <Dialog open={info !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>L&apos;export non è completo</DialogTitle>
          <DialogDescription>
            I filtri attivi selezionano{" "}
            <strong>{info?.totali.toLocaleString("it-IT")}</strong> {info?.entita},
            ma un singolo export può contenerne al massimo{" "}
            {info?.limite.toLocaleString("it-IT")}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Il file conterrà{" "}
            <strong className="text-foreground">
              {info?.esportate.toLocaleString("it-IT")}
            </strong>{" "}
            righe:{" "}
            <strong className="text-foreground">
              {mancanti.toLocaleString("it-IT")}
            </strong>{" "}
            resteranno fuori.
          </p>
          <p>
            Per esportarle tutte, restringi i filtri (per stato, sede o periodo)
            e scarica più file.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button onClick={onConfirm}>
            Scarica comunque {info?.esportate.toLocaleString("it-IT")} righe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
