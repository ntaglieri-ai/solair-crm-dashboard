"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { IconFileImport, IconUpload, IconDatabase } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function LeadImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleImport = () => {
    // Placeholder: l'import reale verrà collegato al DB quando disponibile.
    toast.info("Import non ancora attivo", {
      description: fileName
        ? `"${fileName}" verrà importato quando il database reale sarà collegato.`
        : "La sorgente verrà importata quando il database reale sarà collegato.",
    })
    onOpenChange(false)
    setFileName(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importa lead</DialogTitle>
          <DialogDescription>
            Carica un file CSV o collega una sorgente esterna per importare i
            lead nel CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Upload CSV */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 px-4 py-8 text-center transition-colors hover:border-navy hover:bg-secondary/60"
          >
            <IconUpload size={26} stroke={1.6} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {fileName ?? "Trascina o seleziona un file CSV"}
            </span>
            <span className="text-xs text-muted-foreground">
              Formati supportati: .csv (max 10MB)
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />

          {/* Sorgente DB futura */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3">
            <IconDatabase
              size={20}
              stroke={1.6}
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Sincronizzazione database
              </span>
              <span className="text-xs text-muted-foreground">
                La connessione al database reale sarà disponibile a breve: i lead
                verranno importati e mantenuti sincronizzati automaticamente.
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleImport} disabled={!fileName}>
            <IconFileImport size={16} stroke={1.8} data-icon="inline-start" />
            Importa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
