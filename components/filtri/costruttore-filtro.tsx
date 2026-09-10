"use client"

import { useState } from "react"
import { Plus, Trash2, FolderPlus, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiFilterSelect } from "@/components/shared/multi-filter-select"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  contaCondizioni,
  operatoreSenzaValore,
  OPERATORI_PER_TIPO,
  potaVuoti,
  type CampoFiltrabile,
  type Condizione,
  type Connettore,
  type Gruppo,
  type Nodo,
  type Operatore,
  type TipoCampo,
} from "@/lib/filtri/albero"
import type { GruppoCampi } from "@/lib/filtri/catalogo-lead"

/**
 * Il costruttore dei filtri.
 *
 * Sta in una finestra grande e non nel pannello laterale: componendo gruppi
 * annidati i rientri crescono, e in una colonna da 340 pixel diventerebbero
 * illeggibili dopo il secondo livello.
 *
 * Un gruppo tiene insieme delle condizioni con un connettore — tutte in E
 * oppure tutte in O — e puo' contenere altri gruppi. E' cosi' che si dice
 * "(Sede e' Catania OPPURE Sede e' Palermo) E Stato e' Contattato", che una
 * lista piatta non sa esprimere.
 */

const ETICHETTA_OPERATORE: Record<Operatore, string> = {
  contiene: "contiene",
  non_contiene: "non contiene",
  uguale: "è",
  diverso: "non è",
  inizia_con: "inizia con",
  uno_di: "è uno di",
  nessuno_di: "non è nessuno di",
  maggiore: "maggiore di",
  minore: "minore di",
  fra: "fra",
  ultimi_giorni: "negli ultimi (giorni)",
  prima: "prima del",
  dopo: "dopo il",
  vero: "è sì",
  falso: "è no",
  presente: "ne ha",
  assente: "non ne ha",
  vuoto: "è vuoto",
  non_vuoto: "non è vuoto",
}

function condizioneVuota(campo: CampoFiltrabile): Condizione {
  return {
    tipo: "condizione",
    campo: campo.chiave,
    operatore: OPERATORI_PER_TIPO[campo.tipo][0],
    valori: [],
  }
}

/** Sostituisce un nodo in profondita' senza mutare l'albero originale. */
function sostituisci(gruppo: Gruppo, percorso: number[], nuovo: Nodo | null): Gruppo {
  const [indice, ...resto] = percorso
  const nodi = [...gruppo.nodi]

  if (resto.length === 0) {
    if (nuovo === null) nodi.splice(indice, 1)
    else nodi[indice] = nuovo
    return { ...gruppo, nodi }
  }

  const figlio = nodi[indice]
  if (!figlio || figlio.tipo !== "gruppo") return gruppo
  nodi[indice] = sostituisci(figlio, resto, nuovo)
  return { ...gruppo, nodi }
}

function aggiungi(gruppo: Gruppo, percorso: number[], nodo: Nodo): Gruppo {
  if (percorso.length === 0) return { ...gruppo, nodi: [...gruppo.nodi, nodo] }
  const [indice, ...resto] = percorso
  const nodi = [...gruppo.nodi]
  const figlio = nodi[indice]
  if (!figlio || figlio.tipo !== "gruppo") return gruppo
  nodi[indice] = aggiungi(figlio, resto, nodo)
  return { ...gruppo, nodi }
}

export function CostruttoreFiltro({
  aperto,
  onChiudi,
  gruppi,
  valoreIniziale,
  onApplica,
  onSalva,
}: {
  aperto: boolean
  onChiudi: () => void
  gruppi: GruppoCampi[]
  valoreIniziale: Gruppo
  onApplica: (gruppo: Gruppo) => void
  onSalva: (nome: string, gruppo: Gruppo) => Promise<void>
}) {
  const [albero, setAlbero] = useState<Gruppo>(valoreIniziale)
  const [nome, setNome] = useState("")
  const [salvataggio, setSalvataggio] = useState(false)

  const catalogo = gruppi.flatMap((gruppo) => gruppo.campi)
  const perChiave = new Map(catalogo.map((campo) => [campo.chiave, campo]))
  const totale = contaCondizioni(albero)

  function modifica(percorso: number[], nodo: Nodo | null) {
    setAlbero((corrente) => sostituisci(corrente, percorso, nodo))
  }

  return (
    <Dialog open={aperto} onOpenChange={(v) => (!v ? onChiudi() : undefined)}>
      <DialogContent className="flex max-h-[88vh] w-[min(1000px,94vw)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Costruisci filtro</DialogTitle>
          <DialogDescription>
            Le condizioni di un gruppo valgono tutte insieme (E) oppure in alternativa (O).
            Un gruppo può contenerne altri, per combinare le due cose.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <NodoGruppo
            gruppo={albero}
            percorso={[]}
            gruppiCampi={gruppi}
            perChiave={perChiave}
            radice
            onModifica={modifica}
            onAggiungiCondizione={(percorso, campo) =>
              setAlbero((corrente) => aggiungi(corrente, percorso, condizioneVuota(campo)))
            }
            onAggiungiGruppo={(percorso) =>
              setAlbero((corrente) =>
                aggiungi(corrente, percorso, { tipo: "gruppo", connettore: "o", nodi: [] }),
              )
            }
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-4 border-t border-border bg-secondary/20 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full flex-col gap-1.5 sm:max-w-sm">
            <Label htmlFor="filtro-nome" className="text-xs font-medium">
              Salva come filtro
            </Label>
            <div className="flex gap-2">
              <Input
                id="filtro-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="es. Installazioni da fare"
              />
              <Button
                variant="outline"
                className="shrink-0 bg-card"
                disabled={!nome.trim() || totale === 0 || salvataggio}
                onClick={async () => {
                  setSalvataggio(true)
                  try {
                    await onSalva(nome.trim(), potaVuoti(albero))
                    setNome("")
                  } finally {
                    setSalvataggio(false)
                  }
                }}
              >
                {salvataggio ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Salva
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              I filtri salvati sono visibili a tutti.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {totale === 0
                ? "Nessuna condizione"
                : `${totale} condizion${totale === 1 ? "e" : "i"}`}
            </span>
            <Button variant="outline" className="bg-card" onClick={onChiudi}>
              Annulla
            </Button>
            <Button
              className="bg-teal text-teal-foreground hover:bg-teal/90"
              disabled={totale === 0}
              onClick={() => {
                onApplica(potaVuoti(albero))
                onChiudi()
              }}
            >
              Applica
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NodoGruppo({
  gruppo,
  percorso,
  gruppiCampi,
  perChiave,
  radice = false,
  onModifica,
  onAggiungiCondizione,
  onAggiungiGruppo,
}: {
  gruppo: Gruppo
  percorso: number[]
  gruppiCampi: GruppoCampi[]
  perChiave: Map<string, CampoFiltrabile>
  radice?: boolean
  onModifica: (percorso: number[], nodo: Nodo | null) => void
  onAggiungiCondizione: (percorso: number[], campo: CampoFiltrabile) => void
  onAggiungiGruppo: (percorso: number[]) => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg",
        radice
          ? "border border-border bg-card p-3"
          : "border border-border bg-secondary/40 p-3",
      )}
    >
      <div className="flex items-center gap-2">
        <SceltaConnettore
          valore={gruppo.connettore}
          onCambia={(connettore) => onModifica(percorso, { ...gruppo, connettore })}
        />
        <span className="text-xs text-muted-foreground">
          {gruppo.connettore === "e"
            ? "tutte le condizioni devono valere"
            : "basta che ne valga una"}
        </span>

        {!radice ? (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7 text-destructive hover:text-destructive"
            aria-label="Elimina gruppo"
            onClick={() => onModifica(percorso, null)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>

      {radice && gruppo.nodi.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Nessuna condizione</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Aggiungi una <span className="font-medium">condizione</span> per filtrare su un
            campo, oppure un <span className="font-medium">gruppo</span> per combinare più
            condizioni in alternativa fra loro — per esempio “Sede è Catania oppure Palermo”.
          </p>
        </div>
      ) : null}

      {gruppo.nodi.map((nodo, indice) => {
        const figlio = [...percorso, indice]
        if (nodo.tipo === "gruppo") {
          return (
            <NodoGruppo
              key={indice}
              gruppo={nodo}
              percorso={figlio}
              gruppiCampi={gruppiCampi}
              perChiave={perChiave}
              onModifica={onModifica}
              onAggiungiCondizione={onAggiungiCondizione}
              onAggiungiGruppo={onAggiungiGruppo}
            />
          )
        }
        const campo = perChiave.get(nodo.campo)
        if (!campo) return null
        return (
          <RigaCondizione
            key={indice}
            condizione={nodo}
            campo={campo}
            onCambia={(nuova) => onModifica(figlio, nuova)}
            onElimina={() => onModifica(figlio, null)}
          />
        )
      })}

      <div className="flex flex-wrap gap-2">
        <SceltaCampo
          gruppi={gruppiCampi}
          onScelto={(campo) => onAggiungiCondizione(percorso, campo)}
        />
        <Button
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={() => onAggiungiGruppo(percorso)}
        >
          <FolderPlus data-icon="inline-start" />
          Gruppo
        </Button>
      </div>
    </div>
  )
}

function SceltaConnettore({
  valore,
  onCambia,
}: {
  valore: Connettore
  onCambia: (valore: Connettore) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      {(["e", "o"] as const).map((opzione) => (
        <button
          key={opzione}
          type="button"
          onClick={() => onCambia(opzione)}
          className={cn(
            "px-3 py-1 text-xs font-semibold uppercase transition-colors",
            valore === opzione
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-secondary",
          )}
        >
          {opzione}
        </button>
      ))}
    </div>
  )
}

function SceltaCampo({
  gruppi,
  onScelto,
}: {
  gruppi: GruppoCampi[]
  onScelto: (campo: CampoFiltrabile) => void
}) {
  const perChiave = new Map(
    gruppi.flatMap((gruppo) => gruppo.campi).map((campo) => [campo.chiave, campo]),
  )

  return (
    <Select
      value=""
      onValueChange={(chiave) => {
        const campo = chiave ? perChiave.get(chiave) : undefined
        if (campo) onScelto(campo)
      }}
    >
      <SelectTrigger size="sm" className="w-52 bg-card">
        <Plus className="size-3.5" />
        <SelectValue placeholder="Condizione" />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {gruppi.map((gruppo) => (
          <SelectGroup key={gruppo.chiave}>
            <SelectLabel>{gruppo.etichetta}</SelectLabel>
            {gruppo.campi.map((campo) => (
              <SelectItem key={campo.chiave} value={campo.chiave}>
                {campo.etichetta}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function RigaCondizione({
  condizione,
  campo,
  onCambia,
  onElimina,
}: {
  condizione: Condizione
  campo: CampoFiltrabile
  onCambia: (condizione: Condizione) => void
  onElimina: () => void
}) {
  const operatori = OPERATORI_PER_TIPO[campo.tipo]
  const senzaValore = operatoreSenzaValore(condizione.operatore)

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
      <span className="min-w-32 text-sm font-medium text-foreground">{campo.etichetta}</span>

      <Select
        value={condizione.operatore}
        onValueChange={(valore) =>
          onCambia({ ...condizione, operatore: (valore ?? operatori[0]) as Operatore, valori: [] })
        }
      >
        <SelectTrigger size="sm" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operatori.map((operatore) => (
            <SelectItem key={operatore} value={operatore}>
              {ETICHETTA_OPERATORE[operatore]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!senzaValore ? (
        <EditorValore
          tipo={campo.tipo}
          opzioni={campo.opzioni}
          operatore={condizione.operatore}
          valori={condizione.valori}
          onCambia={(valori) => onCambia({ ...condizione, valori })}
        />
      ) : null}

      <Button
        variant="ghost"
        size="icon"
        className="ml-auto size-7 text-destructive hover:text-destructive"
        aria-label="Elimina condizione"
        onClick={onElimina}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

function EditorValore({
  tipo,
  opzioni,
  operatore,
  valori,
  onCambia,
}: {
  tipo: TipoCampo
  opzioni?: readonly string[]
  operatore: Operatore
  valori: (string | number | boolean)[]
  onCambia: (valori: (string | number | boolean)[]) => void
}) {
  // "fra" vuole due estremi: un solo campo lascerebbe il filtro incompleto
  // senza che si capisca perche'.
  if (operatore === "fra") {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          className="h-8 w-28"
          type={tipo === "data" ? "date" : "number"}
          value={String(valori[0] ?? "")}
          onChange={(e) => onCambia([e.target.value, valori[1] ?? ""])}
        />
        <span className="text-xs text-muted-foreground">e</span>
        <Input
          className="h-8 w-28"
          type={tipo === "data" ? "date" : "number"}
          value={String(valori[1] ?? "")}
          onChange={(e) => onCambia([valori[0] ?? "", e.target.value])}
        />
      </div>
    )
  }

  if (opzioni?.length) {
    // Piu' valori sullo stesso campo sono gia' un "oppure": e' il caso piu'
    // frequente, e non deve costare un gruppo.
    const scelti = valori.map(String)
    return (
      <MultiFilterSelect
        ariaLabel="Scegli valori del filtro"
        className="h-8 w-72 max-w-full bg-card text-sm"
        value={scelti}
        onValueChange={onCambia}
        allLabel="Scegli valori"
        options={opzioni.map((opzione) => ({ value: opzione, label: opzione }))}
      />
    )
  }

  return (
    <Input
      className="h-8 w-56"
      type={tipo === "numero" ? "number" : tipo === "data" ? "date" : "text"}
      value={String(valori[0] ?? "")}
      onChange={(e) => onCambia([e.target.value])}
      placeholder="Valore"
    />
  )
}
