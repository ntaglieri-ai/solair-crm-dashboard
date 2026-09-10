"use client"

import { useCallback, useEffect, useState } from "react"
import { Bookmark, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { contaCondizioni, type Gruppo } from "@/lib/filtri/albero"

/**
 * I filtri salvati, in cima al pannello.
 *
 * Sono condivisi fra tutti: chi ne costruisce uno utile lo lascia ai
 * colleghi. E' la differenza principale rispetto a Zoho, dove restano
 * personali e non si possono passare — un limite di cui gli utenti si
 * lamentano apertamente.
 */

export type FiltroSalvato = {
  id: string
  nome: string
  definizione: Gruppo
  creato_da: string | null
}

export function FiltriSalvati({
  modulo,
  attivo,
  onApplica,
  ricarica,
}: {
  modulo: string
  /** Id del filtro attualmente applicato, per evidenziarlo. */
  attivo?: string | null
  onApplica: (filtro: FiltroSalvato) => void
  /** Cambia quando un filtro viene salvato, per rileggere l'elenco. */
  ricarica?: number
}) {
  const [filtri, setFiltri] = useState<FiltroSalvato[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const carica = useCallback(async () => {
    setCaricamento(true)
    try {
      const risposta = await fetch(`/api/filtri-salvati?modulo=${modulo}`, { cache: "no-store" })
      const dati = (await risposta.json()) as { filtri?: FiltroSalvato[] }
      setFiltri(dati.filtri ?? [])
    } catch {
      // Un elenco che non si carica non deve impedire di filtrare a mano:
      // resta vuoto e il resto del pannello funziona.
      setFiltri([])
    } finally {
      setCaricamento(false)
    }
  }, [modulo])

  useEffect(() => {
    void carica()
  }, [carica, ricarica])

  async function elimina(id: string, nome: string) {
    if (!window.confirm(`Eliminare il filtro "${nome}"? Sparisce per tutti.`)) return
    await fetch(`/api/filtri-salvati?id=${id}`, { method: "DELETE" }).catch(() => {})
    void carica()
  }

  if (caricamento) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Filtri salvati…
      </div>
    )
  }

  if (!filtri.length) return null

  return (
    <div className="border-b border-border px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Bookmark className="size-3.5 text-muted-foreground" />
        Filtri salvati
        <span className="text-xs font-normal text-muted-foreground">{filtri.length}</span>
      </p>

      <div className="flex flex-col gap-1">
        {filtri.map((filtro) => (
          <div key={filtro.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onApplica(filtro)}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                attivo === filtro.id
                  ? "border-teal bg-teal/10 font-medium text-teal"
                  : "border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              <span className="truncate">{filtro.nome}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {contaCondizioni(filtro.definizione)}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground/60 hover:text-destructive"
              aria-label={`Elimina ${filtro.nome}`}
              onClick={() => void elimina(filtro.id, filtro.nome)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
