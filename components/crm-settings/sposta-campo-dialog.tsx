"use client"

import { useState } from "react"
import { IconArrowsMove } from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { spostaCampo, type DestinazioneCampo } from "@/lib/crm-settings/sposta-campo"

export type PaginaDestinazione = {
  id: string
  label: string
  blocchi: { id: string; label: string }[]
}

/**
 * Scelta della destinazione di un campo.
 *
 * Elenca tutte le pagine del modulo con i loro blocchi, comprese quelle che
 * blocchi non ne hanno ancora: li' il campo non avrebbe dove stare, quindi il
 * blocco viene creato al volo prendendo il nome della pagina. Senza quel ramo
 * una pagina come Documenti resterebbe irraggiungibile.
 */
export function SpostaCampoDialog({
  open,
  onOpenChange,
  modulo,
  campoId,
  campoEtichetta,
  bloccoCorrente,
  pagine,
  onSpostato,
}: {
  open: boolean
  onOpenChange: (aperto: boolean) => void
  modulo: string
  campoId: string
  campoEtichetta: string
  bloccoCorrente: string
  pagine: PaginaDestinazione[]
  /** Richiamata a spostamento riuscito: ricarica il layout di chi chiama. */
  onSpostato: () => void | Promise<void>
}) {
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function scegli(chiave: string, destinazione: DestinazioneCampo) {
    setInCorso(chiave)
    setErrore(null)
    const esito = await spostaCampo(modulo, campoId, destinazione)
    setInCorso(null)
    if (!esito.ok) {
      setErrore(esito.errore)
      return
    }
    await onSpostato()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sposta &ldquo;{campoEtichetta}&rdquo;</DialogTitle>
          <DialogDescription>
            Scegli il blocco di destinazione. Il layout è condiviso: la modifica
            vale per tutti gli utenti.
          </DialogDescription>
        </DialogHeader>

        {errore ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errore}
          </p>
        ) : null}

        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
          {pagine.map((pagina) => (
            <div key={pagina.id} className="flex flex-col gap-1">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {pagina.label}
              </p>

              {pagina.blocchi.length === 0 ? (
                <button
                  type="button"
                  disabled={inCorso !== null}
                  onClick={() =>
                    scegli(pagina.id, {
                      tipo: "pagina-vuota",
                      paginaId: pagina.id,
                      etichettaBlocco: pagina.label,
                    })
                  }
                  className="flex items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {inCorso === pagina.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Crea un blocco &ldquo;{pagina.label}&rdquo; e sposta qui
                </button>
              ) : (
                pagina.blocchi.map((blocco) => {
                  const corrente = blocco.id === bloccoCorrente
                  return (
                    <button
                      key={blocco.id}
                      type="button"
                      disabled={corrente || inCorso !== null}
                      onClick={() => scegli(blocco.id, { tipo: "blocco", bloccoId: blocco.id })}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-sm transition-colors",
                        corrente
                          ? "cursor-default bg-secondary/60 text-muted-foreground"
                          : "text-foreground hover:bg-secondary disabled:opacity-50",
                      )}
                    >
                      <span className="min-w-0 truncate">{blocco.label}</span>
                      {corrente ? (
                        <span className="shrink-0 text-[11px] uppercase tracking-wide">
                          posizione attuale
                        </span>
                      ) : inCorso === blocco.id ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin" />
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Icona di comando, uguale nei due punti in cui il comando compare. */
export function SpostaCampoIcona({ className }: { className?: string }) {
  return <IconArrowsMove className={cn("size-3.5", className)} stroke={1.8} />
}
