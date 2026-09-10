"use client"

import { useEffect, useRef, useState } from "react"
import { Code2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Il campo del messaggio.
 *
 * I modelli importati da Zoho sono pagine HTML complete: trentamila
 * caratteri di fogli di stile, tabelle e immagini. Mostrarli in una casella
 * di testo significa far leggere codice a chi voleva solo mandare un'email.
 *
 * Quando il contenuto e' HTML si scrive quindi direttamente sul messaggio
 * come lo vedra' il destinatario: si clicca sul testo e si modifica, senza
 * mai incontrare un tag. Il pulsante "Modifica HTML" resta per i casi in cui
 * serve intervenire sul markup.
 *
 * Quando invece si scrive a mano resta la casella di sempre: un messaggio di
 * tre righe non ha bisogno d'altro.
 */

/** Riconosce un contenuto HTML da uno scritto a mano. */
export function sembraHtml(testo: string): boolean {
  return /<\s*(html|body|table|div|p|br|span|img)\b/i.test(testo)
}

/**
 * Toglie gli script prima di disegnare l'anteprima.
 *
 * L'anteprima e' modificabile, quindi non puo' essere isolata del tutto: il
 * documento deve restare raggiungibile per leggerne le modifiche. Uno script
 * dentro un modello girerebbe allora nella pagina del CRM, e i modelli
 * arrivano da un sistema esterno.
 */
function senzaScript(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

export function CampoMessaggio({
  id,
  value,
  onChange,
  disabled,
  rows = 6,
  placeholder = "Scrivi il messaggio…",
}: {
  id: string
  value: string
  onChange: (valore: string) => void
  disabled?: boolean
  rows?: number
  placeholder?: string
}) {
  const html = sembraHtml(value)
  const [mostraCodice, setMostraCodice] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Il documento disegnato nell'anteprima. Non segue ogni battuta: se il
  // contenuto venisse riscritto a ogni carattere, il cursore tornerebbe
  // all'inizio a ogni tasto premuto. Cambia solo quando il testo arriva da
  // fuori — per esempio scegliendo un modello.
  const [documento, setDocumento] = useState(() => senzaScript(value))
  const ultimoEmesso = useRef(value)

  useEffect(() => {
    if (value === ultimoEmesso.current) return
    ultimoEmesso.current = value
    setDocumento(senzaScript(value))
  }, [value])

  const anteprima = html && !mostraCodice
  const attesaRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(attesaRef.current), [])

  /** Rende il documento modificabile e riporta fuori quello che si scrive. */
  function preparaAnteprima() {
    const finestra = iframeRef.current?.contentWindow
    const doc = finestra?.document
    if (!doc) return

    // Modificabile il CORPO, non l'intero documento: con designMode attivo
    // un "seleziona tutto" cancellava anche la testa del documento, fogli di
    // stile compresi, e del modello restava il solo testo digitato.
    if (doc.body) doc.body.contentEditable = disabled ? "false" : "true"

    const leggi = () => {
      const aggiornato = "<!doctype html>" + doc.documentElement.outerHTML
      ultimoEmesso.current = aggiornato
      onChange(aggiornato)
    }

    // Si legge quando si smette di scrivere, non a ogni tasto: leggere
    // l'intero documento a ogni battuta su trentamila caratteri renderebbe
    // la scrittura scattosa.
    doc.addEventListener("blur", leggi, true)
    doc.addEventListener("input", () => {
      clearTimeout(attesaRef.current)
      attesaRef.current = setTimeout(leggi, 500)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Messaggio</Label>
        {html ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMostraCodice((corrente) => !corrente)}
          >
            {anteprima ? (
              <>
                <Code2 data-icon="inline-start" />
                Modifica HTML
              </>
            ) : (
              <>
                <Eye data-icon="inline-start" />
                Torna all&apos;anteprima
              </>
            )}
          </Button>
        ) : null}
      </div>

      {anteprima ? (
        <>
          <iframe
            ref={iframeRef}
            title="Messaggio"
            srcDoc={documento}
            onLoad={preparaAnteprima}
            className="min-h-[420px] w-full flex-1 rounded-md border border-border bg-white"
          />
          <p className="text-[11px] text-muted-foreground">
            Clicca sul testo per modificarlo. I segnaposto come {"{nome}"} vengono sostituiti
            al momento dell&apos;invio.
          </p>
        </>
      ) : (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            ultimoEmesso.current = event.target.value
            onChange(event.target.value)
          }}
          placeholder={placeholder}
          className={cn("min-h-[320px] flex-1", html && "font-mono text-xs")}
        />
      )}
    </div>
  )
}
