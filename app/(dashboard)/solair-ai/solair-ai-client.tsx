"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  Check,
  FileText,
  Inbox,
  Loader2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ENTITA_LABEL, STATO_INIZIALE } from "@/lib/solair-ai/tipi"
import type {
  EsitoApplicazione,
  FileCandidato,
  MessaggioChat,
  PropostaAI,
  RevisionePending,
  RisposteChat,
  StatoConversazione,
} from "@/lib/solair-ai/tipi"
import { cn } from "@/lib/utils"

const BENVENUTO =
  "Ciao, sono SolairAI. Dimmi su cosa stai lavorando — per esempio \"ho caricato dei documenti " +
  "per un lead\" — e vado a vedere se su Nextcloud c'e' qualcosa di nuovo da leggere."

let contatoreId = 0
function nuovoId() {
  contatoreId += 1
  return `msg-${contatoreId}`
}

function ElencoFile({ file }: { file: FileCandidato[] }) {
  if (file.length === 0) return null
  return (
    <ul className="mt-3 flex flex-col gap-1 border-t border-border/60 pt-2">
      {file.map((voce) => (
        <li key={voce.path} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <FileText className="mt-0.5 size-3 shrink-0" />
          <span className="break-all">{voce.path}</span>
        </li>
      ))}
    </ul>
  )
}

function TabellaProposta({ proposta }: { proposta: PropostaAI }) {
  if (proposta.campi.length === 0) return null
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[320px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">Campo</th>
            <th className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">
              Valore trovato
            </th>
          </tr>
        </thead>
        <tbody>
          {proposta.campi.map((campo) => (
            <tr key={campo.campo} className="border-b border-border/40 last:border-b-0">
              <td className="px-2.5 py-1.5 font-medium text-foreground">{campo.etichetta}</td>
              <td className="px-2.5 py-1.5 text-foreground">{campo.valore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bolla({ messaggio }: { messaggio: MessaggioChat }) {
  const utente = messaggio.ruolo === "utente"
  return (
    <div className={cn("flex w-full", utente ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(46rem,88%)] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          utente
            ? "bg-navy text-navy-foreground"
            : "border border-border bg-card text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{messaggio.testo}</p>
        {messaggio.proposta ? <TabellaProposta proposta={messaggio.proposta} /> : null}
        {messaggio.file ? <ElencoFile file={messaggio.file} /> : null}
      </div>
    </div>
  )
}

/**
 * La coda si carica al montaggio, e il montaggio avviene solo quando la
 * scheda "Revisioni" viene aperta: il chiamante la disegna solo allora.
 * Nessuno `setState` sincrono nell'effetto — il primo statement e' la
 * fetch, tutto il resto succede dopo un await.
 */
function CodaRevisioni() {
  const [revisioni, setRevisioni] = useState<RevisionePending[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [inCorso, setInCorso] = useState<string | null>(null)

  useEffect(() => {
    let annullato = false

    async function carica() {
      try {
        const risposta = await fetch("/api/solair-ai/revisioni", { cache: "no-store" })
        const corpo = (await risposta.json().catch(() => null)) as
          | { revisioni?: RevisionePending[]; errore?: string | null; error?: string }
          | null
        if (annullato) return
        if (!risposta.ok) {
          setErrore(corpo?.error ?? "Coda non leggibile.")
          return
        }
        setRevisioni(corpo?.revisioni ?? [])
        setErrore(corpo?.errore ?? null)
      } catch {
        if (!annullato) setErrore("Coda non leggibile. Controlla la connessione.")
      } finally {
        if (!annullato) setCaricamento(false)
      }
    }

    void carica()
    return () => {
      annullato = true
    }
  }, [])

  async function decidi(id: string, decisione: "accetta" | "rifiuta") {
    setInCorso(id)
    try {
      const risposta = await fetch("/api/solair-ai/revisioni", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decisione }),
      })
      if (!risposta.ok) {
        const corpo = (await risposta.json().catch(() => null)) as { error?: string } | null
        toast.error(corpo?.error ?? "Operazione non riuscita.")
        return
      }
      setRevisioni((precedenti) => precedenti.filter((riga) => riga.id !== id))
      toast.success(decisione === "accetta" ? "Valore applicato." : "Proposta scartata.")
    } catch {
      toast.error("Operazione non riuscita. Controlla la connessione.")
    } finally {
      setInCorso(null)
    }
  }

  if (caricamento) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carico la coda...
      </div>
    )
  }

  if (errore) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <span>{errore}</span>
      </div>
    )
  }

  if (revisioni.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-10 text-center">
        <Inbox className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Nessuna revisione in attesa</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Qui finiscono i campi gia&apos; valorizzati per cui un documento propone un valore
          diverso. SolairAI non li sovrascrive mai da solo.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {revisioni.map((revisione) => (
        <div
          key={revisione.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{ENTITA_LABEL[revisione.record_tipo]}</Badge>
            <span className="text-sm font-semibold text-foreground">
              {revisione.campo_etichetta ?? revisione.campo}
            </span>
            {revisione.creato_da_nome ? (
              <span className="text-xs text-muted-foreground">
                proposta da {revisione.creato_da_nome}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Valore attuale
              </p>
              <p className="mt-0.5 break-words text-sm text-foreground">
                {revisione.valore_attuale || "(vuoto)"}
              </p>
            </div>
            <div className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Valore proposto
              </p>
              <p className="mt-0.5 break-words text-sm text-foreground">
                {revisione.valore_proposto}
              </p>
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <FileText className="mt-0.5 size-3 shrink-0" />
            <span className="break-all">{revisione.fonte_documento}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={inCorso === revisione.id}
              onClick={() => decidi(revisione.id, "accetta")}
            >
              <Check className="size-4" />
              Applica il nuovo valore
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={inCorso === revisione.id}
              onClick={() => decidi(revisione.id, "rifiuta")}
            >
              <X className="size-4" />
              Tieni quello attuale
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SolairAiClient({
  canRun,
  canReview,
  cartelleConfigurate,
}: {
  canRun: boolean
  canReview: boolean
  cartelleConfigurate: number
}) {
  const [messaggi, setMessaggi] = useState<MessaggioChat[]>([
    { id: nuovoId(), ruolo: "bot", testo: BENVENUTO },
  ])
  const [stato, setStato] = useState<StatoConversazione>({ ...STATO_INIZIALE })
  const [bozza, setBozza] = useState("")
  const [inAttesa, setInAttesa] = useState(false)
  const [tab, setTab] = useState("chat")
  const fondo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messaggi, inAttesa])

  const aggiungi = useCallback((messaggio: Omit<MessaggioChat, "id">) => {
    setMessaggi((precedenti) => [...precedenti, { ...messaggio, id: nuovoId() }])
  }, [])

  async function applica(proposta: PropostaAI) {
    const risposta = await fetch("/api/solair-ai/applica", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposta }),
    })
    const corpo = (await risposta.json().catch(() => null)) as
      | (EsitoApplicazione & { error?: string })
      | null

    if (!risposta.ok || !corpo) {
      aggiungi({
        ruolo: "bot",
        testo: corpo?.error ?? "Non sono riuscito a scrivere sul CRM. Non ho modificato niente.",
      })
      return
    }

    const righe = [
      corpo.creato
        ? `Fatto: ho creato ${ENTITA_LABEL[proposta.entita].toLowerCase()} "${proposta.nome}".`
        : `Fatto: ho aggiornato ${proposta.recordEtichetta ?? proposta.nome}.`,
      "",
      `- Campi scritti: ${corpo.aggiornati.length}`,
      `- In revisione (gia' pieni, non sovrascritti): ${corpo.inRevisione.length}`,
      `- File registrati come letti: ${corpo.fileRegistrati}`,
      "",
      "Ho lasciato una nota di riepilogo sulla scheda.",
    ]
    if (corpo.inRevisione.length > 0 && canReview) {
      righe.push("Le proposte in revisione le trovi nella scheda \"Revisioni\".")
    }

    aggiungi({ ruolo: "bot", testo: righe.join("\n") })
    setStato({ entita: proposta.entita, nome: proposta.nome, proposta: null })
  }

  async function invia() {
    const testo = bozza.trim()
    if (testo === "" || inAttesa) return

    const conversazione: MessaggioChat[] = [
      ...messaggi,
      { id: nuovoId(), ruolo: "utente", testo },
    ]
    setMessaggi(conversazione)
    setBozza("")
    setInAttesa(true)

    try {
      const risposta = await fetch("/api/solair-ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messaggi: conversazione.map((messaggio) => ({
            ruolo: messaggio.ruolo,
            testo: messaggio.testo,
          })),
          stato,
        }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | (RisposteChat & { error?: string })
        | null

      if (!risposta.ok || !corpo) {
        aggiungi({ ruolo: "bot", testo: corpo?.error ?? "Qualcosa non ha funzionato. Riprova." })
        return
      }

      setStato(corpo.stato)

      // Conferma riconosciuta: la scrittura la fa /applica, e la proposta che
      // gli passiamo e' quella che l'utente ha visto — il server la rilegge e
      // la rivalida comunque prima di toccare il record.
      if (corpo.applica) {
        if (stato.proposta) {
          await applica(stato.proposta)
        } else {
          // Non dovrebbe succedere (il server risponde `applica` solo se la
          // proposta gliel'abbiamo mandata noi), ma restare zitti dopo un
          // "si'" farebbe credere all'utente di aver salvato.
          aggiungi({
            ruolo: "bot",
            testo: "Ho perso il filo della proposta e non ho scritto niente. Riprova a dirmi su chi stiamo lavorando.",
          })
        }
        return
      }

      aggiungi({
        ruolo: "bot",
        testo: corpo.messaggio,
        proposta: corpo.stato.proposta,
        file: corpo.stato.proposta ? undefined : corpo.file,
      })
    } catch {
      aggiungi({ ruolo: "bot", testo: "Non riesco a raggiungere il server. Riprova." })
    } finally {
      setInAttesa(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#6f42c1]/10 text-[#6f42c1]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">SolairAI</h1>
            <p className="text-sm text-muted-foreground">
              Legge i documenti che carichi su Nextcloud e li porta sulla scheda giusta.
            </p>
          </div>
        </div>
      </div>

      {cartelleConfigurate === 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Nessuna cartella Nextcloud configurata. Va impostata in CRM Settings, AI Features,
            SolairAI: finche&apos; manca, non ho da dove leggere.
          </span>
        </div>
      ) : null}

      {!canRun ? (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Puoi consultare questa pagina ma non avviare letture o scritture: manca il permesso
            &quot;Avvia aggiornamenti e creazioni&quot;.
          </span>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="chat">Conversazione</TabsTrigger>
          {canReview ? <TabsTrigger value="revisioni">Revisioni</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="flex flex-col gap-4">
            <div className="flex min-h-[22rem] flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
              {messaggi.map((messaggio) => (
                <Bolla key={messaggio.id} messaggio={messaggio} />
              ))}
              {inAttesa ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Sto guardando su Nextcloud...
                </div>
              ) : null}
              <div ref={fondo} />
            </div>

            <div className="flex items-end gap-2">
              <Textarea
                value={bozza}
                disabled={!canRun || inAttesa}
                placeholder={
                  canRun
                    ? "Es. ho caricato le info per un lead"
                    : "Serve il permesso di avviare gli aggiornamenti"
                }
                rows={2}
                className="min-h-[3rem] resize-none"
                onChange={(evento) => setBozza(evento.target.value)}
                onKeyDown={(evento) => {
                  // Invio manda, Shift+Invio va a capo: e' la convenzione di
                  // qualunque chat, e qui i messaggi sono quasi sempre una riga.
                  if (evento.key === "Enter" && !evento.shiftKey) {
                    evento.preventDefault()
                    void invia()
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                aria-label="Invia"
                disabled={!canRun || inAttesa || bozza.trim() === ""}
                onClick={() => void invia()}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Non scrivo niente sul CRM senza il tuo &quot;si&apos;&quot; in chat. I campi gia&apos;
              pieni non li sovrascrivo mai: finiscono in revisione.
            </p>
          </div>
        </TabsContent>

        {canReview ? (
          <TabsContent value="revisioni" className="mt-4">
            {/* Montata solo a scheda aperta: e' li' che la coda si carica. */}
            {tab === "revisioni" ? <CodaRevisioni /> : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
