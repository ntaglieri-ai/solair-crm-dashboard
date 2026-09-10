"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"

/**
 * Scelta del modello quando si scrive un'email.
 *
 * Senza, la libreria dei modelli resta una pagina di impostazioni che
 * nessuno usa: e' qui che serve, nel momento in cui si sta per scrivere.
 *
 * Vengono proposti solo i modelli ATTIVI del modulo giusto — sui Clienti i
 * loro, sui Lead i loro. Dei cinquantasei importati da Zoho la maggior parte
 * nasce spenta, e proporli tutti renderebbe la tendina inutilizzabile.
 */

type Template = {
  id: string
  nome: string
  oggetto: string
  corpo: string
  cartella: string | null
}

const SUFFISSO_NUOVO = " (nuovo)"

function nomeVisibile(nome: string): string {
  return nome.endsWith(SUFFISSO_NUOVO) ? nome.slice(0, -SUFFISSO_NUOVO.length) : nome
}

export function ScegliModello({
  modulo,
  disabled,
  onScelto,
}: {
  /** Modulo del record a cui si sta scrivendo. */
  modulo: "clienti" | "lead" | "installatori"
  disabled?: boolean
  /** Riceve oggetto e corpo del modello scelto. */
  onScelto: (modello: { oggetto: string; corpo: string }) => void
}) {
  const [modelli, setModelli] = useState<Template[]>([])
  const [caricamento, setCaricamento] = useState(true)

  const carica = useCallback(async () => {
    setCaricamento(true)
    try {
      const risposta = await fetch(
        `/api/crm-settings/email-template?modulo=${modulo}&soloAttivi=1`,
        { cache: "no-store" },
      )
      const dati = (await risposta.json()) as { template?: Template[] }
      setModelli(dati.template ?? [])
    } catch {
      // Se l'elenco non arriva si scrive a mano: meglio una tendina assente
      // che un errore davanti a chi voleva solo mandare un'email.
      setModelli([])
    } finally {
      setCaricamento(false)
    }
  }, [modulo])

  useEffect(() => {
    void carica()
  }, [carica])

  if (caricamento) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Modelli disponibili…
      </div>
    )
  }

  if (!modelli.length) return null

  // Raggruppati per cartella, come stavano su Zoho: sui Clienti sono
  // quarantotto, e un elenco piatto sarebbe da scorrere a lungo.
  const perCartella = new Map<string, Template[]>()
  for (const modello of modelli) {
    const cartella = modello.cartella ?? "Senza cartella"
    const gruppo = perCartella.get(cartella) ?? []
    gruppo.push(modello)
    perCartella.set(cartella, gruppo)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="scegli-modello" className="flex items-center gap-1.5">
        <FileText className="size-3.5 text-muted-foreground" />
        Parti da un modello
      </Label>
      <Select
        value=""
        disabled={disabled}
        onValueChange={(id) => {
          const modello = id ? modelli.find((m) => m.id === id) : undefined
          if (modello) onScelto({ oggetto: modello.oggetto, corpo: modello.corpo })
        }}
      >
        <SelectTrigger id="scegli-modello">
          <SelectValue placeholder="Nessun modello — scrivo da zero" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {[...perCartella.entries()].map(([cartella, elenco]) => (
            <SelectGroup key={cartella}>
              <SelectLabel>{cartella}</SelectLabel>
              {elenco.map((modello) => (
                <SelectItem key={modello.id} value={modello.id}>
                  {nomeVisibile(modello.nome)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Conferma prima di sovrascrivere quello che si e' gia' scritto.
 *
 * Se i campi sono vuoti sostituisce e basta: chiedere conferma per
 * sovrascrivere il nulla sarebbe solo un clic in piu'.
 */
export function confermaSovrascrittura(oggetto: string, corpo: string): boolean {
  if (!oggetto.trim() && !corpo.trim()) return true
  return window.confirm(
    "Hai già scritto qualcosa: applicando il modello verrà sostituito. Procedo?",
  )
}
