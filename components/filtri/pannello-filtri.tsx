"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Maximize2, RotateCcw, Save, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { FiltriSalvati } from "@/components/filtri/filtri-salvati"
import { CostruttoreFiltro } from "@/components/filtri/costruttore-filtro"
import {
  contaCondizioni,
  operatoreSenzaValore,
  OPERATORI_PER_TIPO,
  type CampoFiltrabile,
  type Condizione,
  type Gruppo,
  type Operatore,
} from "@/lib/filtri/albero"
import type { GruppoCampi } from "@/lib/filtri/catalogo-lead"

/**
 * Il pannello dei filtri, uguale per tutti i moduli che lo usano.
 *
 * Riceve il catalogo dei campi — che ogni modulo ricava dal proprio layout —
 * e da quello costruisce tutto: gruppi, controlli, operatori. Scriverne uno
 * per modulo significherebbe correggere ogni difetto tante volte quanti sono
 * i moduli, ed e' cosi' che sul Lead quattro campi sono rimasti non
 * filtrabili per mesi.
 *
 * Lavora direttamente sull'albero del filtro: le condizioni composte qui
 * sono le stesse che si compongono nel costruttore, quindi passare
 * dall'uno all'altro non perde nulla.
 *
 * Il pannello del Lead resta separato e non passa di qui: e' la lista piu'
 * pesante del CRM, tarata sui suoi tempi di risposta, e non vale la pena
 * rimetterci mano per un lavoro che serve altrove.
 */

export function PannelloFiltri({
  titolo,
  modulo,
  gruppi,
  albero,
  onCambia,
  trigger,
  visteRapide,
  inline = false,
  aperto = false,
  onApertoChange,
  contenitore,
}: {
  titolo: string
  /** Modulo per i filtri salvati ("clienti", "installatori"). */
  modulo: string
  gruppi: GruppoCampi[]
  albero: Gruppo | null
  onCambia: (albero: Gruppo | null) => void
  trigger: (ctx: { onClick: () => void; count: number }) => ReactNode
  /** Scorciatoie in cima, opzionali: etichetta e filtro che applicano. */
  visteRapide?: Array<{ chiave: string; etichetta: string; albero: Gruppo | null }>
  inline?: boolean
  aperto?: boolean
  onApertoChange?: (aperto: boolean) => void
  /** Dove disegnare il pannello quando e' incastonato nella pagina. */
  contenitore?: HTMLElement | null
}) {
  const [costruttoreAperto, setCostruttoreAperto] = useState(false)
  const [filtroSalvatoAttivo, setFiltroSalvatoAttivo] = useState<string | null>(null)
  const [versioneSalvati, setVersioneSalvati] = useState(0)
  const [ricerca, setRicerca] = useState("")
  const [gruppiAperti, setGruppiAperti] = useState<Set<string>>(new Set())

  // Bozza locale: la lista si aggiorna mentre si compone, ma con una piccola
  // attesa — spuntare tre caselle non deve far partire tre interrogazioni.
  const [bozza, setBozza] = useState<Gruppo>(albero ?? { tipo: "gruppo", connettore: "e", nodi: [] })
  const cambiaRef = useRef(onCambia)
  useEffect(() => {
    cambiaRef.current = onCambia
  }, [onCambia])
  useEffect(() => {
    const attesa = setTimeout(() => {
      cambiaRef.current(bozza.nodi.length ? bozza : null)
    }, 350)
    return () => clearTimeout(attesa)
  }, [bozza])

  const perChiave = useMemo(
    () => new Map(gruppi.flatMap((g) => g.campi).map((campo) => [campo.chiave, campo])),
    [gruppi],
  )

  const condizioni = bozza.nodi.filter(
    (nodo): nodo is Condizione => nodo.tipo === "condizione",
  )
  const totale = contaCondizioni(bozza)

  // Con la ricerca attiva i gruppi si aprono da soli: cercare un campo e
  // trovarlo dentro una sezione chiusa non aiuterebbe.
  const gruppiFiltrati = useMemo(() => {
    const query = ricerca.trim().toLowerCase()
    if (!query) return gruppi
    return gruppi
      .map((gruppo) => ({
        ...gruppo,
        campi: gruppo.campi.filter((campo) =>
          campo.etichetta.toLowerCase().includes(query),
        ),
      }))
      .filter((gruppo) => gruppo.campi.length > 0)
  }, [gruppi, ricerca])

  function impostaCondizione(chiave: string, condizione: Condizione | null) {
    setBozza((corrente) => {
      const altre = corrente.nodi.filter(
        (nodo) => nodo.tipo !== "condizione" || nodo.campo !== chiave,
      )
      return { ...corrente, nodi: condizione ? [...altre, condizione] : altre }
    })
    setFiltroSalvatoAttivo(null)
  }

  async function salvaFiltro(nome: string, gruppo: Gruppo) {
    const risposta = await fetch("/api/filtri-salvati", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modulo, nome, definizione: gruppo }),
    })
    if (!risposta.ok) {
      const dati = (await risposta.json().catch(() => ({}))) as { error?: string }
      toast.error(dati.error ?? "Salvataggio non riuscito")
      return
    }
    toast.success(`Filtro "${nome}" salvato e condiviso`)
    setVersioneSalvati((v) => v + 1)
  }

  const contenuto = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="text-base font-semibold text-foreground">{titolo}</p>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Apri il costruttore"
            title="Costruisci un filtro con condizioni e gruppi"
            onClick={() => setCostruttoreAperto(true)}
          >
            <Maximize2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chiudi"
            onClick={() => onApertoChange?.(false)}
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <FiltriSalvati
          modulo={modulo}
          attivo={filtroSalvatoAttivo}
          ricarica={versioneSalvati}
          azione={
            totale > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={async () => {
                  const nome = window.prompt("Nome del filtro (lo vedranno tutti):")?.trim()
                  if (nome) await salvaFiltro(nome, bozza)
                }}
              >
                <Save data-icon="inline-start" />
                Salva
              </Button>
            ) : null
          }
          onApplica={(filtro) => {
            setFiltroSalvatoAttivo(filtro.id)
            setBozza(filtro.definizione)
          }}
        />

        {visteRapide?.length ? (
          <div className="border-b border-border px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-foreground">Viste rapide</p>
            <div className="flex flex-wrap gap-1.5">
              {visteRapide.map((vista) => (
                <button
                  key={vista.chiave}
                  type="button"
                  onClick={() =>
                    setBozza(vista.albero ?? { tipo: "gruppo", connettore: "e", nodi: [] })
                  }
                  className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {vista.etichetta}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca campo…"
              className="pl-8"
            />
          </div>
        </div>

        {condizioni.length ? (
          <div className="flex flex-wrap gap-1.5 border-b border-border bg-secondary/30 px-4 py-3">
            {condizioni.map((condizione) => {
              const campo = perChiave.get(condizione.campo)
              if (!campo) return null
              return (
                <span
                  key={condizione.campo}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal"
                >
                  <span className="truncate">{riassunto(campo, condizione)}</span>
                  <button
                    type="button"
                    aria-label={`Togli ${campo.etichetta}`}
                    onClick={() => impostaCondizione(condizione.campo, null)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )
            })}
          </div>
        ) : null}

        <div className="flex flex-col">
          {gruppiFiltrati.map((gruppo) => {
            const apertoGruppo = Boolean(ricerca.trim()) || gruppiAperti.has(gruppo.chiave)
            return (
              <div key={gruppo.chiave} className="border-b border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                  onClick={() =>
                    setGruppiAperti((corrente) => {
                      const nuovo = new Set(corrente)
                      if (nuovo.has(gruppo.chiave)) nuovo.delete(gruppo.chiave)
                      else nuovo.add(gruppo.chiave)
                      return nuovo
                    })
                  }
                >
                  {apertoGruppo ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {gruppo.etichetta}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {gruppo.campi.length}
                  </span>
                </button>

                {apertoGruppo ? (
                  <div className="flex flex-col gap-3 px-4 pb-3">
                    {gruppo.campi.map((campo) => (
                      <ControlloCampo
                        key={campo.chiave}
                        campo={campo}
                        condizione={condizioni.find((c) => c.campo === campo.chiave) ?? null}
                        onCambia={(condizione) => impostaCondizione(campo.chiave, condizione)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <Button
          variant="outline"
          className="w-full bg-card"
          disabled={totale === 0}
          onClick={() => {
            setBozza({ tipo: "gruppo", connettore: "e", nodi: [] })
            setFiltroSalvatoAttivo(null)
          }}
        >
          <RotateCcw data-icon="inline-start" />
          Reimposta tutto
        </Button>
      </div>
    </div>
  )

  const costruttore = (
    <CostruttoreFiltro
      aperto={costruttoreAperto}
      onChiudi={() => setCostruttoreAperto(false)}
      gruppi={gruppi}
      valoreIniziale={bozza}
      onApplica={(gruppo) => {
        setFiltroSalvatoAttivo(null)
        setBozza(gruppo)
      }}
      onSalva={salvaFiltro}
    />
  )

  const pulsante = trigger({
    onClick: () => onApertoChange?.(!aperto),
    count: totale,
  })

  if (inline) {
    return (
      <>
        {pulsante}
        {costruttore}
        {aperto && contenitore
          ? createPortal(
              <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                {contenuto}
              </aside>,
              contenitore,
            )
          : null}
      </>
    )
  }

  return (
    <>
      {pulsante}
      {costruttore}
      {aperto ? (
        <div className="fixed inset-y-0 right-0 z-50 w-[340px] border-l border-border bg-card shadow-lg">
          {contenuto}
        </div>
      ) : null}
    </>
  )
}

/** Riassunto di una condizione, per la pillola. */
function riassunto(campo: CampoFiltrabile, condizione: Condizione): string {
  if (operatoreSenzaValore(condizione.operatore)) {
    const etichette: Partial<Record<Operatore, string>> = {
      vero: "Sì",
      falso: "No",
      presente: "ne ha",
      assente: "non ne ha",
      vuoto: "vuoto",
      non_vuoto: "non vuoto",
    }
    return `${campo.etichetta}: ${etichette[condizione.operatore] ?? ""}`
  }
  return `${campo.etichetta}: ${condizione.valori.join(", ")}`
}

/**
 * Il controllo di un campo nel pannello.
 *
 * Nel pannello si compone la forma piu' comune — un operatore per tipo,
 * quello che serve nel novantacinque per cento dei casi. Chi ha bisogno di
 * altro apre il costruttore, dove ci sono tutti gli operatori e i gruppi.
 */
function ControlloCampo({
  campo,
  condizione,
  onCambia,
}: {
  campo: CampoFiltrabile
  condizione: Condizione | null
  onCambia: (condizione: Condizione | null) => void
}) {
  const operatorePredefinito = OPERATORI_PER_TIPO[campo.tipo][0]

  if (campo.tipo === "booleano" || campo.tipo === "collegato") {
    const acceso = campo.tipo === "booleano" ? "vero" : "presente"
    const spento = campo.tipo === "booleano" ? "falso" : "assente"
    const corrente = condizione?.operatore

    return (
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{campo.etichetta}</span>
        <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border">
          {[
            { valore: null, etichetta: "Tutti" },
            { valore: acceso, etichetta: "Sì" },
            { valore: spento, etichetta: "No" },
          ].map((opzione) => (
            <button
              key={opzione.etichetta}
              type="button"
              onClick={() =>
                onCambia(
                  opzione.valore
                    ? {
                        tipo: "condizione",
                        campo: campo.chiave,
                        operatore: opzione.valore as Operatore,
                        valori: [],
                      }
                    : null,
                )
              }
              className={cn(
                "px-2.5 py-1 text-xs transition-colors",
                (opzione.valore ?? null) === (corrente ?? null)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {opzione.etichetta}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (campo.opzioni?.length) {
    const scelti = (condizione?.valori ?? []).map(String)
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {campo.etichetta}
        </span>
        <div className="flex flex-wrap gap-1">
          {campo.opzioni.map((opzione) => {
            const attivo = scelti.includes(opzione)
            return (
              <button
                key={opzione}
                type="button"
                onClick={() => {
                  const nuovi = attivo
                    ? scelti.filter((v) => v !== opzione)
                    : [...scelti, opzione]
                  onCambia(
                    nuovi.length
                      ? {
                          tipo: "condizione",
                          campo: campo.chiave,
                          operatore: "uno_di",
                          valori: nuovi,
                        }
                      : null,
                  )
                }}
                className={cn(
                  "max-w-full truncate rounded-full border px-2.5 py-1 text-xs transition-colors",
                  attivo
                    ? "border-teal bg-teal/10 font-medium text-teal"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {opzione}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {campo.etichetta}
      </span>
      <Input
        value={String(condizione?.valori[0] ?? "")}
        type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
        placeholder={campo.tipo === "testo" ? "contiene…" : ""}
        onChange={(e) => {
          const valore = e.target.value
          onCambia(
            valore.trim()
              ? {
                  tipo: "condizione",
                  campo: campo.chiave,
                  operatore: operatorePredefinito,
                  valori: [valore],
                }
              : null,
          )
        }}
      />
    </div>
  )
}
