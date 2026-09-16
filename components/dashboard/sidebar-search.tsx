"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { useSidebarCollapse } from "@/lib/sidebar-collapse"
import {
  RICERCA_GLOBALE_MIN_CARATTERI,
  type RicercaGlobaleTipo,
  type RisultatoRicercaGlobale,
} from "@/lib/shared/ricerca-globale"

const TIPO_LABEL: Record<RicercaGlobaleTipo, string> = {
  cliente: "Clienti",
  lead: "Lead",
  installatore: "Installatori",
}

/** Ordine dei gruppi nel pannello, indipendente da quello della risposta. */
const TIPO_ORDER: RicercaGlobaleTipo[] = ["cliente", "lead", "installatore"]

/** Attesa prima di interrogare il server, per non partire a ogni tasto. */
const DEBOUNCE_MS = 300

/** Risposta del server insieme al testo che l'ha prodotta. */
type Esito = {
  q: string
  results: RisultatoRicercaGlobale[]
  errore: boolean
}

/**
 * Ricerca globale sempre presente nella barra laterale, sotto la data.
 *
 * Il pannello dei risultati si apre di lato — a destra della barra, sopra il
 * contenuto della pagina — e non sotto: la barra e' larga 248px, compressa
 * 76px, e un elenco incolonnato la' dentro sarebbe illeggibile e spingerebbe
 * la navigazione fuori schermo. Nel menu mobile, che e' gia' un pannello
 * largo quanto lo schermo, a destra non c'e' spazio: li' i risultati vanno
 * sotto il campo, ed e' quello che fa `mobile`.
 *
 * L'esito e' tenuto insieme al testo che l'ha prodotto: mostriamo i risultati
 * solo finche' corrispondono a cio' che c'e' scritto ora nel campo, cosi'
 * fra un tasto e l'altro non compaiono per un istante le risposte alla query
 * precedente. Dalla stessa corrispondenza si ricava anche lo stato "sto
 * caricando", che quindi non puo' restare acceso per sbaglio.
 */
export function SidebarSearch({
  collapsed = false,
  mobile = false,
  onNavigate,
}: {
  collapsed?: boolean
  mobile?: boolean
  onNavigate?: () => void
}) {
  const router = useRouter()
  const { setCollapsed } = useSidebarCollapse()
  const panelId = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Il focus non puo' partire nello stesso gesto che espande la barra: il
  // campo non esiste ancora. Un ref, e non uno stato, perche' serve solo a
  // ricordare un'intenzione fino al disegno successivo.
  const focusAllaRiapertura = useRef(false)

  const trimmed = query.trim()
  const abbastanzaLungo = trimmed.length >= RICERCA_GLOBALE_MIN_CARATTERI
  const esitoCorrente = esito?.q === trimmed ? esito : null
  const loading = abbastanzaLungo && esitoCorrente === null

  useEffect(() => {
    if (!abbastanzaLungo) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search/globale?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Ricerca non riuscita")
          return res.json() as Promise<{ results: RisultatoRicercaGlobale[] }>
        })
        .then((data) => {
          setEsito({ q: trimmed, results: data.results, errore: false })
          setActiveIndex(0)
        })
        .catch((errore: unknown) => {
          // L'annullamento e' la via normale quando si continua a digitare:
          // la richiesta seguente e' gia' partita, quindi non tocchiamo
          // niente e lo spinner resta acceso fino alla sua risposta.
          if (errore instanceof DOMException && errore.name === "AbortError") return
          setEsito({ q: trimmed, results: [], errore: true })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, abbastanzaLungo])

  useEffect(() => {
    if (collapsed || !focusAllaRiapertura.current) return
    focusAllaRiapertura.current = false
    inputRef.current?.focus()
  }, [collapsed])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  // I gruppi vuoti spariscono, cosi' l'indice attivo della tastiera scorre
  // esattamente le voci disegnate e Invio apre sempre quella evidenziata.
  const gruppi = useMemo(() => {
    const results = esitoCorrente?.results ?? []
    return TIPO_ORDER.map((tipo) => ({
      tipo,
      voci: results.filter((r) => r.tipo === tipo),
    })).filter((gruppo) => gruppo.voci.length > 0)
  }, [esitoCorrente])
  const ordinati = useMemo(() => gruppi.flatMap((gruppo) => gruppo.voci), [gruppi])
  // Una risposta piu' corta della precedente lascerebbe l'indice oltre la
  // fine della lista: evidenziare "niente" e far cadere Invio nel vuoto.
  const indiceAttivo = Math.min(activeIndex, Math.max(ordinati.length - 1, 0))

  function chiudi() {
    setOpen(false)
    setQuery("")
    setEsito(null)
    setActiveIndex(0)
  }

  function apri(risultato: RisultatoRicercaGlobale) {
    chiudi()
    onNavigate?.()
    router.push(risultato.href)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      chiudi()
      inputRef.current?.blur()
      return
    }
    if (ordinati.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((indiceAttivo + 1) % ordinati.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((indiceAttivo - 1 + ordinati.length) % ordinati.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const scelto = ordinati[indiceAttivo]
      if (scelto) apri(scelto)
    }
  }

  const mostraPannello = open && abbastanzaLungo

  // Compressa, la barra e' larga 76px e il campo non ci sta: resta la sola
  // lente, che la riapre e poi porta il focus sul campo appena disegnato.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          focusAllaRiapertura.current = true
          setCollapsed(false)
          setOpen(true)
        }}
        aria-label="Cerca nel CRM"
        title="Cerca nel CRM"
        className="mt-3 flex w-full items-center justify-center rounded-lg py-2 text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-[18px]" />
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative mt-3">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={mostraPannello}
        aria-controls={mostraPannello ? panelId : undefined}
        aria-autocomplete="list"
        value={query}
        placeholder="Cerca nel CRM…"
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 pl-8 pr-8 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {loading ? (
        <Loader2
          className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : query ? (
        <button
          type="button"
          onClick={() => {
            chiudi()
            inputRef.current?.focus()
          }}
          aria-label="Svuota la ricerca"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}

      {mostraPannello ? (
        <div
          id={panelId}
          role="listbox"
          aria-label="Risultati della ricerca"
          className={cn(
            "z-50 max-h-[min(420px,70vh)] overflow-y-auto rounded-xl border border-sidebar-border bg-popover p-1.5 shadow-lg",
            mobile ? "absolute inset-x-0 top-full mt-2" : "absolute left-full top-0 ml-3 w-80",
          )}
        >
          {gruppi.map((gruppo) => (
            <div key={gruppo.tipo} className="flex flex-col">
              <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {TIPO_LABEL[gruppo.tipo]}
              </p>
              {gruppo.voci.map((voce) => {
                const indice = ordinati.indexOf(voce)
                return (
                  <button
                    key={`${voce.tipo}-${voce.id}`}
                    type="button"
                    role="option"
                    aria-selected={indice === indiceAttivo}
                    onMouseEnter={() => setActiveIndex(indice)}
                    onClick={() => apri(voce)}
                    className={cn(
                      "flex min-w-0 flex-col rounded-lg px-2 py-1.5 text-left transition-colors",
                      indice === indiceAttivo ? "bg-sidebar-accent" : "hover:bg-muted",
                    )}
                  >
                    <span className="truncate text-sm font-semibold text-foreground">
                      {voce.nome}
                    </span>
                    {voce.dettaglio ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {voce.dettaglio}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
          {loading ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Ricerca…</p>
          ) : esitoCorrente?.errore ? (
            <p className="px-2 py-4 text-center text-xs text-destructive">
              Ricerca non riuscita. Riprova.
            </p>
          ) : ordinati.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Nessun risultato per “{trimmed}”
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
