"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  contaCondizioni,
  type CampoFiltrabile,
  type Condizione,
  type Gruppo,
  type Nodo,
  type Operatore,
} from "@/lib/filtri/albero"

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
  onModifica,
  ricarica,
  azione,
  campi = [],
}: {
  modulo: string
  /** Id del filtro attualmente applicato, per evidenziarlo. */
  attivo?: string | null
  onApplica: (filtro: FiltroSalvato) => void
  /** Apre il costruttore sul filtro salvato, per aggiornarlo. */
  onModifica?: (filtro: FiltroSalvato) => void
  /** Cambia quando un filtro viene salvato, per rileggere l'elenco. */
  ricarica?: number
  /** Pulsante accanto al titolo, es. "Salva". */
  azione?: React.ReactNode
  /** Catalogo del modulo, usato per mostrare nomi campo leggibili nell'anteprima. */
  campi?: CampoFiltrabile[]
}) {
  const [filtri, setFiltri] = useState<FiltroSalvato[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [dettaglioAperto, setDettaglioAperto] = useState<string | null>(null)
  const campiPerChiave = useMemo(
    () => new Map(campi.map((campo) => [campo.chiave, campo])),
    [campi],
  )

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
    const timer = window.setTimeout(() => void carica(), 0)
    return () => window.clearTimeout(timer)
  }, [carica, ricarica])

  async function elimina(id: string, nome: string) {
    if (!window.confirm(`Eliminare il filtro "${nome}"? Sparisce per tutti.`)) return
    await fetch(`/api/filtri-salvati?id=${id}`, { method: "DELETE" }).catch(() => {})
    setDettaglioAperto((corrente) => (corrente === id ? null : corrente))
    void carica()
  }

  if (caricamento) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Filtri salvati…
      </div>
    )
  }

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Bookmark className="size-3.5 text-muted-foreground" />
          Filtri salvati
          {filtri.length ? (
            <span className="rounded-full bg-secondary px-1.5 text-xs font-normal text-muted-foreground">
              {filtri.length}
            </span>
          ) : null}
        </p>
        {azione}
      </div>

      {!filtri.length ? (
        <p className="text-xs text-muted-foreground">
          Nessuno ancora. Componi un filtro e salvalo: lo vedranno tutti.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {filtri.map((filtro) => {
          const aperto = dettaglioAperto === filtro.id
          const totale = contaCondizioni(filtro.definizione)
          return (
            <div key={filtro.id} className="rounded-lg border border-border bg-card">
              <button
                type="button"
                onClick={() => setDettaglioAperto(aperto ? null : filtro.id)}
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  attivo === filtro.id
                    ? "bg-teal/10 font-medium text-teal"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform",
                      aperto && "rotate-90",
                    )}
                  />
                  <span className="truncate">{filtro.nome}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  {attivo === filtro.id ? (
                    <CheckCircle2 className="size-3.5 text-teal" />
                  ) : null}
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {totale}
                  </span>
                </span>
              </button>

              {aperto ? (
                <div className="border-t border-border px-2.5 pb-2.5 pt-2">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {filtro.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totale} condizion{totale === 1 ? "e" : "i"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Chiudi dettaglio filtro"
                      onClick={() => setDettaglioAperto(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <FiltroPreview gruppo={filtro.definizione} campi={campiPerChiave} />

                  <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-1.5">
                    <Button
                      size="sm"
                      className="bg-teal text-teal-foreground hover:bg-teal/90"
                      onClick={() => onApplica(filtro)}
                    >
                      Applica
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="bg-card"
                      aria-label={`Modifica ${filtro.nome}`}
                      onClick={() => onModifica?.(filtro)}
                      disabled={!onModifica}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Elimina ${filtro.nome}`}
                      onClick={() => void elimina(filtro.id, filtro.nome)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ETICHETTA_OPERATORE: Record<Operatore, string> = {
  contiene: "contiene",
  non_contiene: "non contiene",
  uguale: "è",
  diverso: "non è",
  inizia_con: "inizia con",
  uno_di: "è",
  nessuno_di: "non è",
  maggiore: "maggiore di",
  minore: "minore di",
  fra: "fra",
  ultimi_giorni: "negli ultimi giorni",
  prima: "prima del",
  dopo: "dopo il",
  vero: "è sì",
  falso: "è no",
  presente: "è presente",
  assente: "non è presente",
  vuoto: "è vuoto",
  non_vuoto: "non è vuoto",
}

export function FiltroPreview({
  gruppo,
  campi,
}: {
  gruppo: Gruppo
  campi: Map<string, CampoFiltrabile>
}) {
  if (contaCondizioni(gruppo) === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        Nessuna condizione nel filtro.
      </p>
    )
  }

  return (
    <div className="max-h-72 overflow-y-auto">
      <GruppoPreview gruppo={gruppo} campi={campi} radice />
    </div>
  )
}

function GruppoPreview({
  gruppo,
  campi,
  radice = false,
}: {
  gruppo: Gruppo
  campi: Map<string, CampoFiltrabile>
  radice?: boolean
}) {
  const nodi = gruppo.nodi.filter((nodo) => contaCondizioni(nodo) > 0)
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-border bg-background p-2",
        !radice && "bg-secondary/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase text-secondary-foreground">
          {gruppo.connettore === "e" ? "Devono valere tutte" : "Ne basta una"}
        </span>
      </div>

      <div className="space-y-1.5">
        {nodi.map((nodo, index) => (
          <div key={index} className="space-y-1.5">
            {index > 0 ? (
              <div className="pl-2 text-[10px] font-bold uppercase text-muted-foreground">
                {gruppo.connettore === "e" ? "E" : "O"}
              </div>
            ) : null}
            <NodoPreview nodo={nodo} campi={campi} />
          </div>
        ))}
      </div>
    </div>
  )
}

function NodoPreview({
  nodo,
  campi,
}: {
  nodo: Nodo
  campi: Map<string, CampoFiltrabile>
}) {
  if (nodo.tipo === "gruppo") {
    return <GruppoPreview gruppo={nodo} campi={campi} />
  }

  return <CondizionePreview condizione={nodo} campo={campi.get(nodo.campo)} />
}

function CondizionePreview({
  condizione,
  campo,
}: {
  condizione: Condizione
  campo?: CampoFiltrabile
}) {
  const valori = formattaValori(condizione, campo)
  return (
    <div className="rounded-md border border-border/70 bg-card px-2.5 py-2">
      <p className="text-xs font-semibold text-foreground">
        {campo?.etichetta ?? condizione.campo}
      </p>
      <p className="mt-0.5 break-words text-xs text-muted-foreground">
        {ETICHETTA_OPERATORE[condizione.operatore]}
        {valori ? <span className="font-medium text-foreground"> {valori}</span> : null}
      </p>
    </div>
  )
}

function formattaValori(condizione: Condizione, campo?: CampoFiltrabile): string {
  if (!condizione.valori.length) return ""
  const valori = condizione.valori.map((valore) => {
    const testo = String(valore)
    return campo?.etichette?.[testo] ?? testo
  })
  if (condizione.operatore === "fra" && valori.length >= 2) {
    return `${valori[0]} e ${valori[1]}`
  }
  return valori.join(", ")
}
