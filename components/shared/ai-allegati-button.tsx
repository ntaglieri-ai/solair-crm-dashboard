"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, FileText, Loader2, Sparkles, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  EsitoApplicazione,
  FileCandidato,
  PropostaAI,
  RisposteChat,
} from "@/lib/solair-ai/tipi"
import { cn } from "@/lib/utils"

type AiAllegatiButtonProps = {
  className?: string
  size?: "sm" | "default"
  entita?: "lead" | "cliente" | "installatore"
  recordId?: string
  nome?: string
}

function ElencoFile({ file }: { file: FileCandidato[] }) {
  if (file.length === 0) return null
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">File letti</p>
      <ul className="mt-2 flex max-h-28 flex-col gap-1 overflow-auto">
        {file.map((voce) => (
          <li key={voce.path} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <FileText className="mt-0.5 size-3 shrink-0" />
            <span className="break-all">{voce.path}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TabellaProposta({ proposta }: { proposta: PropostaAI }) {
  if (proposta.campi.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[360px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">Campo</th>
            <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground">
              Valore trovato
            </th>
          </tr>
        </thead>
        <tbody>
          {proposta.campi.map((campo) => (
            <tr key={`${campo.campo}-${campo.fonte}`} className="border-b border-border/60 last:border-b-0">
              <td className="px-2.5 py-2 font-medium text-foreground">{campo.etichetta}</td>
              <td className="px-2.5 py-2 text-foreground">{campo.valore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AiAllegatiButton({
  className,
  size,
  entita,
  recordId,
  nome,
}: AiAllegatiButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [proposta, setProposta] = useState<PropostaAI | null>(null)
  const [file, setFile] = useState<FileCandidato[]>([])
  const attivo = Boolean(entita && recordId?.trim() && nome?.trim())

  async function leggiAllegati() {
    if (!entita || !recordId?.trim() || !nome?.trim() || loading || applying) return

    setLoading(true)
    setErrore(null)
    setMessaggio(null)
    setProposta(null)
    setFile([])

    try {
      const risposta = await fetch("/api/solair-ai/allegati-record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entita,
          recordId,
          nome,
        }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | (RisposteChat & { error?: string })
        | null

      if (!risposta.ok || !corpo) {
        setErrore(corpo?.error ?? "Non sono riuscito a leggere gli allegati.")
        return
      }

      setMessaggio(corpo.messaggio)
      setProposta(corpo.stato.proposta)
      setFile(corpo.file ?? corpo.stato.proposta?.file ?? [])
    } catch {
      setErrore("Non riesco a raggiungere SolairAI. Controlla la connessione e riprova.")
    } finally {
      setLoading(false)
    }
  }

  async function applicaProposta() {
    if (!proposta || applying) return
    setApplying(true)
    setErrore(null)

    try {
      const risposta = await fetch("/api/solair-ai/applica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposta }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | (EsitoApplicazione & { error?: string })
        | null

      if (!risposta.ok || !corpo) {
        setErrore(corpo?.error ?? "Non sono riuscito ad aggiornare il CRM.")
        return
      }

      if (corpo.aggiornati.length === 0 && corpo.inRevisione.length === 0) {
        toast.info("Nessuna modifica necessaria", {
          description: "I documenti confermano solo dati già presenti in scheda.",
        })
      } else {
        toast.success("Scheda aggiornata da allegati", {
          description: `${corpo.aggiornati.length} campi scritti, ${corpo.inRevisione.length} in revisione.`,
        })
      }
      setOpen(false)
      setProposta(null)
      router.refresh()
    } catch {
      setErrore("Non riesco a raggiungere SolairAI. Controlla la connessione e riprova.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={!attivo}
        aria-label="Compila scheda da allegati"
        title={attivo ? "Leggi gli allegati della scheda con SolairAI" : "Funzione non configurata per questa scheda"}
        className={cn("bg-card text-[#6f42c1] shadow-sm", className)}
        onClick={() => {
          setOpen(true)
          void leggiAllegati()
        }}
      >
        <Sparkles data-icon="inline-start" />
        Compila da allegati
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#6f42c1]" />
              Compila da allegati
            </DialogTitle>
            <DialogDescription>
              SolairAI legge i nuovi allegati della scheda {nome} e propone i campi da
              aggiornare. Le modifiche partono solo dopo la conferma.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60dvh] flex-col gap-3 overflow-auto pr-1">
            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Lettura degli allegati in corso...
              </div>
            ) : null}

            {errore ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{errore}</span>
              </div>
            ) : null}

            {messaggio ? (
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-foreground">
                {messaggio}
              </div>
            ) : null}

            {proposta ? <TabellaProposta proposta={proposta} /> : null}
            <ElencoFile file={file} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading || applying}
              onClick={() => setOpen(false)}
            >
              Chiudi
            </Button>
            {proposta ? (
              <Button type="button" disabled={loading || applying} onClick={applicaProposta}>
                {applying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {applying ? "Applico..." : "Applica alla scheda"}
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={loading || applying} onClick={leggiAllegati}>
                Riprova lettura
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
