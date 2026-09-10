"use client"

import { useState } from "react"
import { Code2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/**
 * Il campo del messaggio, con anteprima.
 *
 * I modelli importati da Zoho sono pagine HTML complete: trentamila
 * caratteri di fogli di stile, tabelle e immagini. Mostrarli in una casella
 * di testo significa far leggere codice a chi voleva solo mandare un'email,
 * e non dargli alcuna idea di come apparira' il messaggio.
 *
 * Quando il testo e' HTML si mostra quindi l'anteprima — il messaggio come
 * lo vedra' il destinatario — con la possibilita' di passare al codice per
 * chi deve davvero intervenire. Quando invece si scrive a mano, resta la
 * casella di sempre: un messaggio di tre righe non ha bisogno d'altro.
 */

/** Riconosce un contenuto HTML da uno scritto a mano. */
export function sembraHtml(testo: string): boolean {
  return /<\s*(html|body|table|div|p|br|span|img)\b/i.test(testo)
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

  // Su un contenuto scritto a mano l'anteprima non aggiunge niente: si vede
  // gia' quello che si scrive.
  const anteprima = html && !mostraCodice

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
                Anteprima
              </>
            )}
          </Button>
        ) : null}
      </div>

      {anteprima ? (
        <>
          {/* L'anteprima e' isolata in un iframe: il modello porta con se'
              i propri fogli di stile, e senza isolamento riscriverebbe
              l'aspetto della finestra attorno. */}
          <iframe
            title="Anteprima del messaggio"
            srcDoc={value}
            sandbox=""
            className="min-h-0 w-full flex-1 rounded-md border border-border bg-white"
          />
          <p className="text-[11px] text-muted-foreground">
            Anteprima del modello. I segnaposto come {"{nome}"} vengono sostituiti al momento
            dell&apos;invio.
          </p>
        </>
      ) : (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("min-h-0 flex-1", html && "font-mono text-xs")}
        />
      )}
    </div>
  )
}
