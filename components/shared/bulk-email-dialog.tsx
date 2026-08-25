"use client"

// Dialog di composizione + progresso dell'invio email di MASSA, condiviso da
// Lead / Clienti / Installatori (il modulo cambia solo il `recordTipo`).
//
// Due fasi nello stesso dialog:
//  1. "compose" — oggetto, template con placeholder, anteprima resa sul primo
//     destinatario reale e avviso sugli esclusi (proprieta' / email mancante /
//     consenso mancante).
//     I conteggi arrivano da /api/email-massa/preview, che usa la STESSA
//     risoluzione destinatari dell'invio: nessuna stima lato client.
//  2. "sending" — l'invio non e' sincrono (pacing 400ms per destinatario, vedi
//     lib/email/bulk-mailer.ts), quindi qui si polla lo stato del job invece
//     di mostrare un toast di successo immediato che sarebbe una bugia.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { IconMail, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  BULK_PLACEHOLDERS,
  MAX_BULK_RECIPIENTS,
  renderTemplate,
} from "@/lib/email/bulk-template"
import { MittenteSelect, useMittenti } from "@/components/shared/mittente-select"

export type BulkEmailRecordTipo = "lead" | "cliente" | "installatore"

const POLL_MS = 2500

type PreviewResponse = {
  etichetta: { singolare: string; plurale: string }
  totaleRichiesti: number
  destinatari: number
  esclusiNonProprietari: number
  esclusiSenzaEmail: number
  /** Con indirizzo valido ma senza consenso al contatto via email. */
  esclusiSenzaConsenso: number
  /** Interruttore globale del blocco consenso. */
  consensoEnforcementAttivo: boolean
  /** Destinatari senza consenso che verrebbero raggiunti lo stesso (blocco off). */
  inviatiSenzaConsenso: number
  esempio: { email: string; placeholders: Record<string, string> } | null
}

type JobStatus = {
  totale: number
  inviate: number
  fallite: number
  stato: "in_corso" | "completato" | "errore"
  errore: string | null
}

const PLACEHOLDER_HINT = BULK_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")

export function BulkEmailDialog({
  open,
  onOpenChange,
  recordTipo,
  recordIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordTipo: BulkEmailRecordTipo
  recordIds: string[]
}) {
  const [oggetto, setOggetto] = useState("")
  const [template, setTemplate] = useState("")
  // L'anteprima e' memorizzata insieme alla selezione per cui e' stata
  // calcolata: se la selezione cambia mentre il dialog e' aperto, quella
  // vecchia viene scartata senza doverla azzerare dentro l'effect.
  const [previewState, setPreviewState] = useState<{
    key: string
    data: PreviewResponse | null
    error: string | null
  } | null>(null)
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<JobStatus | null>(null)
  // Una sola casella per tutto il batch: si sceglie in composizione e vale per
  // ogni destinatario del job.
  const mittenti = useMittenti(open)

  // Gli id sono un array nuovo a ogni render del genitore: la fetch di
  // anteprima si aggancia alla chiave stabile, non al riferimento.
  const idsKey = recordIds.join(",")

  const reset = useCallback(() => {
    setOggetto("")
    setTemplate("")
    setPreviewState(null)
    setSubmitting(false)
    setJobId(null)
    setJob(null)
  }, [])

  // Anteprima destinatari + stato casella personale, all'apertura.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    fetch("/api/email-massa/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordTipo, recordIds: idsKey.split(",").filter(Boolean) }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as
          | (PreviewResponse & { error?: string })
          | null
        if (cancelled) return
        if (!res.ok || !data) {
          setPreviewState({
            key: idsKey,
            data: null,
            error: data?.error ?? "Impossibile leggere i destinatari.",
          })
          return
        }
        setPreviewState({ key: idsKey, data, error: null })
      })
      .catch(() => {
        if (cancelled) return
        setPreviewState({
          key: idsKey,
          data: null,
          error: "Impossibile leggere i destinatari: errore di rete.",
        })
      })

    fetch("/api/profilo/email-credentials", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setEmailConfigured(Boolean(data.configured))
      })
      .catch(() => {
        if (!cancelled) setEmailConfigured(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, recordTipo, idsKey])

  // Polling dell'avanzamento finche' il job e' in corso. Lo stato del job e'
  // una dipendenza dell'effect: appena passa a completato/errore l'effect si
  // rilancia, esce subito e il cleanup ferma l'intervallo.
  const jobStato = job?.stato ?? null

  useEffect(() => {
    if (!jobId) return
    if (jobStato !== null && jobStato !== "in_corso") return
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(`/api/email-massa/${jobId}/status`, { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as JobStatus
        if (!cancelled) setJob(data)
      } catch {
        // Un poll perso non e' un errore: si riprova al giro successivo.
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [jobId, jobStato])

  const preview = previewState?.key === idsKey ? previewState.data : null
  const previewError = previewState?.key === idsKey ? previewState.error : null

  const destinatari = preview?.destinatari ?? 0
  const esclusiProprieta = preview?.esclusiNonProprietari ?? 0
  const esclusiEmail = preview?.esclusiSenzaEmail ?? 0
  const esclusiConsenso = preview?.esclusiSenzaConsenso ?? 0
  // Default true finche' l'anteprima non risponde: non si mostra un avviso di
  // "blocco spento" per un dato che non e' ancora arrivato.
  const enforcementAttivo = preview?.consensoEnforcementAttivo ?? true
  const senzaConsensoInclusi = preview?.inviatiSenzaConsenso ?? 0
  const esempio = preview?.esempio ?? null

  const oggettoPreview = esempio ? renderTemplate(oggetto, esempio.placeholders) : oggetto
  const corpoPreview = esempio ? renderTemplate(template, esempio.placeholders) : template

  const canSend =
    !submitting &&
    jobId === null &&
    emailConfigured === true &&
    destinatari > 0 &&
    oggetto.trim().length > 0 &&
    template.trim().length > 0 &&
    recordIds.length <= MAX_BULK_RECIPIENTS

  async function handleSend() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/email-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordTipo,
          recordIds,
          oggetto,
          template,
          mittenteId: mittenti.selectedId,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | { jobId?: string; totale?: number; error?: string }
        | null
      if (!res.ok || !data?.jobId) {
        toast.error(data?.error ?? "Invio non riuscito")
        return
      }
      setJobId(data.jobId)
      setJob({
        totale: data.totale ?? destinatari,
        inviate: 0,
        fallite: 0,
        stato: "in_corso",
        errore: null,
      })
    } catch {
      toast.error("Invio non riuscito: errore di rete")
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Chiudere durante l'invio non lo annulla: prosegue in background, e il
      // riepilogo finale arriva come toast.
      if (job && job.stato === "in_corso") {
        toast.info("Invio in corso in background", {
          description: `${job.inviate} di ${job.totale} email inviate finora.`,
        })
      }
      reset()
    }
    onOpenChange(next)
  }

  const inSending = jobId !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {inSending ? "Invio email di massa" : "Invia email di massa"}
          </DialogTitle>
          <DialogDescription>
            {inSending
              ? "L'invio procede in background con una pausa tra un destinatario e l'altro, per non far bloccare la tua casella."
              : previewError
                ? previewError
                : preview
                  ? `${destinatari} destinatari su ${preview.totaleRichiesti} ${preview.etichetta.plurale} selezionati.`
                  : "Lettura dei destinatari…"}
          </DialogDescription>
        </DialogHeader>

        {inSending ? (
          <div className="flex flex-col gap-3 py-2">
            <Progress value={job && job.totale > 0 ? (job.inviate / job.totale) * 100 : 0} />
            <p className="text-sm font-medium text-foreground">
              {job?.stato === "completato"
                ? `Invio completato: ${job.inviate} di ${job.totale} email inviate.`
                : job?.stato === "errore"
                  ? `Invio interrotto: ${job.errore ?? "errore imprevisto"}`
                  : `Invio in corso: ${job?.inviate ?? 0}/${job?.totale ?? 0}`}
            </p>
            {job && job.fallite > 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
                <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0" />
                {job.fallite} invii falliti — controlla gli indirizzi dei destinatari.
              </p>
            ) : null}
            {job?.stato === "completato" && job.fallite === 0 ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <IconCircleCheck size={16} stroke={1.8} className="mt-0.5 shrink-0 text-teal" />
                Tutte le email sono partite dalla tua casella personale.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-1">
            {esclusiProprieta > 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
                <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0" />
                {esclusiProprieta} di {preview?.totaleRichiesti ?? 0} esclusi perché non di tua
                proprietà.
              </p>
            ) : null}
            {esclusiEmail > 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {esclusiEmail} esclusi perché senza indirizzo email.
              </p>
            ) : null}
            {/* Blocco globale spento: l'avviso e' rosso e viene prima di tutto
                il resto. L'agente sta per scrivere a chi non ha acconsentito, e
                deve saperlo mentre compone, non dopo. */}
            {!enforcementAttivo && senzaConsensoInclusi > 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0" />
                Blocco consenso disattivato — invii senza filtro attivi.{" "}
                {senzaConsensoInclusi} destinatari di questa selezione non hanno dato
                il consenso e riceveranno comunque il messaggio. L&apos;invio verra&apos;
                registrato nell&apos;audit log.
              </p>
            ) : null}
            {/* Distinto da "senza indirizzo email": questi un indirizzo ce
                l'hanno, ma non si puo' scrivere loro. Confonderli
                nasconderebbe la sola esclusione a cui l'agente puo' rimediare. */}
            {esclusiConsenso > 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
                <IconAlertTriangle size={16} stroke={1.8} className="mt-0.5 shrink-0" />
                {esclusiConsenso} esclusi perché senza consenso al contatto via email.
                Registra il consenso nella scheda del contatto per poterli
                includere.
              </p>
            ) : null}

            <MittenteSelect state={mittenti} disabled={submitting} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-mail-subject">Oggetto</Label>
              <Input
                id="bulk-mail-subject"
                value={oggetto}
                onChange={(e) => setOggetto(e.target.value)}
                placeholder="Oggetto dell'email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-mail-body">Messaggio</Label>
              <Textarea
                id="bulk-mail-body"
                rows={7}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={`Ciao {nome},\n\n…`}
              />
              <p className="text-xs text-muted-foreground">
                Placeholder disponibili (validi anche nell&apos;oggetto):{" "}
                <span className="font-mono text-foreground">{PLACEHOLDER_HINT}</span> — vengono
                sostituiti con i dati di ogni destinatario.
              </p>
            </div>

            {esempio ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Anteprima — primo destinatario ({esempio.email})
                </span>
                <span className="text-sm font-medium text-foreground">
                  {oggettoPreview || "(nessun oggetto)"}
                </span>
                <span className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                  {corpoPreview || "(nessun messaggio)"}
                </span>
              </div>
            ) : null}

            {emailConfigured === false ? (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-700">
                Prima di inviare devi configurare la tua casella email personale.{" "}
                <Link href="/profilo" className="font-semibold underline">
                  Vai al Profilo
                </Link>
                .
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {inSending ? (
            <Button onClick={() => handleOpenChange(false)}>
              {job?.stato === "in_corso" ? "Chiudi (prosegue in background)" : "Chiudi"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button disabled={!canSend} onClick={handleSend}>
                <IconMail size={16} stroke={1.8} data-icon="inline-start" />
                {submitting ? "Accodamento…" : `Invia a ${destinatari}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
