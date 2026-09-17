"use client"

import { Extension } from "@tiptap/core"
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion"
import { ReactRenderer } from "@tiptap/react"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Digitando "{" nel corpo del modello si apre un menu con i campi del modulo
 * attivo, filtrato in tempo reale da quello che si scrive dopo — lo stesso
 * meccanismo dei mention "@" di Slack/Notion, applicato ai campi del record
 * invece che alle persone.
 *
 * Inserisce testo semplice ({Campo}), non un nodo "mention" atomico: deve
 * restare modificabile carattere per carattere come il resto del testo, ed
 * essere l'identica stringa che lib/email/bulk-template.ts risolve
 * all'invio — un nodo speciale complicherebbe entrambe le cose senza motivo.
 */

const MAX_RISULTATI = 30

type CampoListProps = {
  items: string[]
  command: (item: { id: string }) => void
}

interface CampoListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

const CampoSuggestionList = forwardRef<CampoListHandle, CampoListProps>(
  function CampoSuggestionList({ items, command }, ref) {
    const [selezionato, setSelezionato] = useState(0)

    useEffect(() => setSelezionato(0), [items])

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }) {
        if (items.length === 0) return event.key === "Escape"

        if (event.key === "ArrowDown") {
          setSelezionato((i) => (i + 1) % items.length)
          return true
        }
        if (event.key === "ArrowUp") {
          setSelezionato((i) => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === "Enter" || event.key === "Tab") {
          command({ id: items[selezionato] })
          return true
        }
        if (event.key === "Escape") return true
        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="w-72 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground shadow-lg">
          Nessun campo trovato
        </div>
      )
    }

    return (
      <div className="max-h-72 w-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
        {items.map((item, index) => (
          <button
            key={item}
            type="button"
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground",
              index === selezionato ? "bg-muted" : "hover:bg-muted",
            )}
            // onMouseDown, non onClick: l'editor perde la selezione prima del
            // click, e un onClick arriverebbe dopo che ProseMirror ha gia'
            // chiuso il suggerimento perdendo il "range" da sostituire.
            onMouseDown={(event) => {
              event.preventDefault()
              command({ id: item })
            }}
          >
            <span className="min-w-0 truncate">{item}</span>
          </button>
        ))}
      </div>
    )
  },
)

/**
 * `props.mount()` e' il modo raccomandato da @tiptap/suggestion per montare
 * il popup: usa Floating UI per il posizionamento (con autoUpdate su scroll/
 * resize) e gestisce da solo la chiusura al click fuori. Non imposta pero'
 * uno z-index: il modello si apre dentro un Dialog, quindi va garantito
 * esplicitamente che il popup resti sopra.
 */
const Z_INDEX_SOPRA_DIALOG = "1000"

function renderSuggestion() {
  let renderer: ReactRenderer<CampoListHandle, CampoListProps> | null = null
  let smonta: (() => void) | null = null

  function chiudi() {
    smonta?.()
    renderer?.destroy()
    smonta = null
    renderer = null
  }

  return {
    onStart(props: SuggestionProps) {
      renderer = new ReactRenderer(CampoSuggestionList, {
        props: { items: props.items as string[], command: props.command },
        editor: props.editor,
      })
      renderer.element.style.zIndex = Z_INDEX_SOPRA_DIALOG
      smonta = props.mount(renderer.element)
    },
    onUpdate(props: SuggestionProps) {
      renderer?.updateProps({ items: props.items as string[], command: props.command })
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === "Escape") {
        chiudi()
        return true
      }
      return renderer?.ref?.onKeyDown({ event: props.event }) ?? false
    },
    onExit: chiudi,
  }
}

export interface CampoSuggestionOptions {
  /**
   * Letto a ogni digitazione, non catturato una volta sola: il modulo del
   * modello (Clienti/Lead/Installatori) puo' cambiare mentre l'editor resta
   * aperto, e il menu deve proporre subito i campi giusti.
   */
  getCampi: () => string[]
}

export const CampoSuggestion = Extension.create<CampoSuggestionOptions>({
  name: "campoSuggestion",

  addOptions() {
    return {
      getCampi: () => [],
    }
  },

  addProseMirrorPlugins() {
    const opzioni = this.options
    const config: Omit<SuggestionOptions, "editor"> = {
      char: "{",
      allowSpaces: true,
      items: ({ query }) => {
        const q = query.trim().toLowerCase()
        const campi = opzioni.getCampi()
        const filtrati = q ? campi.filter((campo: string) => campo.toLowerCase().includes(q)) : campi
        return filtrati.slice(0, MAX_RISULTATI)
      },
      command: ({ editor, range, props }) => {
        // Sostituisce l'intero range (la "{" digitata piu' quello che segue)
        // con il token completo: cosi' non si rischia una graffa doppia se
        // l'utente aveva gia' iniziato a scrivere il nome del campo a mano.
        editor.chain().focus().insertContentAt(range, `{${(props as { id: string }).id}}`).run()
      },
      render: renderSuggestion,
    }

    return [
      Suggestion({
        editor: this.editor,
        ...config,
      }),
    ]
  },
})
