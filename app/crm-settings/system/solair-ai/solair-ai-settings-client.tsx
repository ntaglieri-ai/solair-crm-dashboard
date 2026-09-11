"use client"

import { useEffect, useState } from "react"
import { Database, FolderTree, RefreshCw, Save, Search, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { NextcloudFolderPicker } from "@/components/nextcloud/nextcloud-folder-picker"
import { ENTITA_LABEL } from "@/lib/solair-ai/tipi"
import type { EntitaAI } from "@/lib/solair-ai/tipi"

type Impostazione = {
  entita: EntitaAI
  nextcloudPath: string
  attivo: boolean
  indicizzazioneAttiva: boolean
  aggiornatoIl: string | null
  ultimoSyncIl: string | null
  ultimoSyncEsito: string | null
  ultimoSyncErrore: string | null
  ultimoSyncFile: number
}

type StatoIndice = {
  entita: EntitaAI
  sourcePath: string
  active: boolean
  indexingActive: boolean
  files: number
  ready: number
  errors: number
  unsupported: number
  deleted: number
  chunks: number
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  lastSyncFiles: number
  schemaReady: boolean
}

type SyncJob = {
  id: string
  entita: EntitaAI
  modo: "check" | "sync"
  sourcePath: string
  stato: "queued" | "scanning" | "running" | "completed" | "error"
  fase: string
  scanned: number
  totale: number
  processati: number
  daAggiornare: number
  invariati: number
  cancellati: number
  aggiornati: number
  chunks: number
  errori: number
  warnings: number
  totaleBytes: number
  ultimoPath: string | null
  errore: string | null
  updatedAt: string
}

const AIUTO: Record<EntitaAI, string> = {
  lead: "Dentro, una sottocartella per lead oppure file col nome nel titolo.",
  cliente: "La cartella con il materiale dei clienti.",
  installatore: "La cartella con il materiale degli installatori.",
}

const JOB_TERMINALI = new Set(["completed", "error"])

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function jobPercent(job: SyncJob) {
  if (job.stato === "completed") return 100
  if (job.totale > 0) return Math.min(99, Math.round((job.processati / job.totale) * 100))
  if (job.scanned > 0) return job.stato === "scanning" ? 12 : 35
  return 4
}

export function SolairAiSettingsClient({
  impostazioni,
  statoIndice,
  jobAttivi,
  canManage,
}: {
  impostazioni: Impostazione[]
  statoIndice: StatoIndice[]
  jobAttivi: SyncJob[]
  canManage: boolean
}) {
  const [salvate, setSalvate] = useState(impostazioni)
  const [righe, setRighe] = useState(impostazioni)
  const [stato, setStato] = useState(statoIndice)
  const [salvataggio, setSalvataggio] = useState(false)
  const [jobs, setJobs] = useState<Record<EntitaAI, SyncJob | null>>(() => {
    const iniziali: Record<EntitaAI, SyncJob | null> = {
      cliente: null,
      installatore: null,
      lead: null,
    }
    for (const job of jobAttivi) iniziali[job.entita] = job
    return iniziali
  })

  const modificate = JSON.stringify(righe) !== JSON.stringify(salvate)

  function aggiorna(entita: EntitaAI, patch: Partial<Impostazione>) {
    setRighe((precedenti) =>
      precedenti.map((riga) => (riga.entita === entita ? { ...riga, ...patch } : riga)),
    )
  }

  async function aggiornaJob(jobId: string) {
    const risposta = await fetch(`/api/crm-settings/solair-ai/sync/${jobId}`, {
      cache: "no-store",
    })
    const corpo = (await risposta.json().catch(() => null)) as
      | { job?: SyncJob; stato?: StatoIndice[]; error?: string }
      | null

    if (corpo?.stato) setStato(corpo.stato)
    if (!risposta.ok || !corpo?.job) {
      toast.error(corpo?.error ?? "Stato sincronizzazione non disponibile.")
      return
    }

    const job = corpo.job
    setJobs((precedenti) => ({ ...precedenti, [job.entita]: job }))
    if (job.stato === "completed") {
      toast.success(
        job.modo === "check"
          ? `Check completato: ${job.daAggiornare} file da sincronizzare.`
          : "Sincronizzazione SolairAI completata.",
      )
    }
    if (job.stato === "error") {
      toast.error(job.errore ?? "Sincronizzazione SolairAI interrotta.")
    }
  }

  useEffect(() => {
    const attivi = Object.values(jobs).filter(
      (job): job is SyncJob => job != null && !JOB_TERMINALI.has(job.stato),
    )
    if (attivi.length === 0) return

    const timer = window.setInterval(() => {
      for (const job of attivi) void aggiornaJob(job.id)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [jobs])

  async function salva() {
    setSalvataggio(true)
    try {
      const risposta = await fetch("/api/crm-settings/solair-ai", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          impostazioni: righe.map((riga) => ({
            entita: riga.entita,
            nextcloudPath: riga.nextcloudPath,
            attivo: riga.attivo,
            indicizzazioneAttiva: riga.indicizzazioneAttiva,
          })),
        }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | { impostazioni?: Impostazione[]; error?: string }
        | null

      if (!risposta.ok) {
        toast.error(corpo?.error ?? "Salvataggio non riuscito.")
        return
      }
      // Si riparte dai valori normalizzati dal server (path ripuliti), non da
      // quelli digitati: altrimenti il campo resterebbe a mostrare uno slash
      // finale che a database non e' stato scritto.
      if (corpo?.impostazioni) {
        setRighe(corpo.impostazioni)
        setSalvate(corpo.impostazioni)
      }
      toast.success("Configurazione SolairAI salvata.")
    } catch {
      toast.error("Salvataggio non riuscito. Controlla la connessione.")
    } finally {
      setSalvataggio(false)
    }
  }

  async function avviaOperazione(entita: EntitaAI, operation: "check" | "sync") {
    try {
      const risposta = await fetch("/api/crm-settings/solair-ai/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entita, operation }),
      })
      const corpo = (await risposta.json().catch(() => null)) as
        | { job?: SyncJob; stato?: StatoIndice[]; error?: string | null }
        | null

      if (corpo?.stato) setStato(corpo.stato)
      if (!risposta.ok) {
        toast.error(corpo?.error ?? "Operazione SolairAI non avviata.")
        return
      }
      if (corpo?.job) {
        const job = corpo.job
        setJobs((precedenti) => ({ ...precedenti, [job.entita]: job }))
        void aggiornaJob(job.id)
      }
      toast.success(operation === "check" ? "Check SolairAI avviato." : "Sync SolairAI avviata.")
    } catch {
      toast.error("Operazione SolairAI non riuscita. Controlla la connessione.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="SolairAI"
        description="Le cartelle Nextcloud da cui SolairAI legge i documenti, una per tipo di record. Si scelgono sfogliando l'albero reale: l'elenco e' quello che vede l'account con cui SolairAI apre Nextcloud."
        action={
          canManage ? (
            <Button type="button" onClick={salva} disabled={!modificate || salvataggio}>
              <Save className="size-4" />
              {salvataggio ? "Salvataggio..." : "Salva"}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        {righe.map((riga) => {
          const indice = stato.find((voce) => voce.entita === riga.entita)
          const job = jobs[riga.entita]
          const jobAttivo = job && !JOB_TERMINALI.has(job.stato)
          const operazioneDisabilitata =
            !canManage ||
            Boolean(jobAttivo) ||
            !riga.attivo ||
            !riga.indicizzazioneAttiva ||
            !riga.nextcloudPath
          const percentuale = job ? jobPercent(job) : 0

          return (
            <div
              key={riga.entita}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#6f42c1]/10 text-[#6f42c1]">
                  <Sparkles className="size-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {ENTITA_LABEL[riga.entita]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`attivo-${riga.entita}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Lettura attiva
                </Label>
                <Switch
                  id={`attivo-${riga.entita}`}
                  checked={riga.attivo}
                  disabled={!canManage}
                  onCheckedChange={(valore) =>
                    aggiorna(riga.entita, { attivo: valore === true })
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Database className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Indice documentale</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {indice?.schemaReady === false
                      ? "Migration indice non ancora applicata"
                      : `${indice?.files ?? 0} file, ${indice?.chunks ?? 0} sezioni cercabili`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {indice?.lastSyncStatus ? (
                  <Badge variant={indice.lastSyncStatus === "ok" ? "secondary" : "destructive"}>
                    {indice.lastSyncStatus === "ok" ? "ok" : "errore"}
                  </Badge>
                ) : null}
                <Label
                  htmlFor={`indicizzazione-${riga.entita}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Indicizza
                </Label>
                <Switch
                  id={`indicizzazione-${riga.entita}`}
                  checked={riga.indicizzazioneAttiva}
                  disabled={!canManage}
                  onCheckedChange={(valore) =>
                    aggiorna(riga.entita, { indicizzazioneAttiva: valore === true })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={operazioneDisabilitata}
                  onClick={() => void avviaOperazione(riga.entita, "check")}
                >
                  <Search className="size-4" />
                  Controlla
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={operazioneDisabilitata}
                  onClick={() => void avviaOperazione(riga.entita, "sync")}
                >
                  <RefreshCw
                    className={jobAttivo && job?.modo === "sync" ? "size-4 animate-spin" : "size-4"}
                  />
                  Sincronizza
                </Button>
              </div>
            </div>

            {indice?.lastSyncError ? (
              <p className="text-xs text-destructive">{indice.lastSyncError}</p>
            ) : null}

            {job ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    {job.modo === "check" ? "Check modifiche" : "Sincronizzazione"} ·{" "}
                    {job.stato === "completed"
                      ? "completata"
                      : job.stato === "error"
                        ? "errore"
                        : job.fase}
                  </span>
                  <span className="text-muted-foreground">
                    {job.totale > 0 ? `${job.processati}/${job.totale}` : `${job.scanned} file trovati`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      job.stato === "error"
                        ? "h-full rounded-full bg-destructive transition-all"
                        : "h-full rounded-full bg-[#20a47a] transition-all"
                    }
                    style={{ width: `${percentuale}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{job.daAggiornare} da sincronizzare</span>
                  <span>{job.invariati} invariati</span>
                  <span>{job.cancellati} cancellati</span>
                  <span>{formatBytes(job.totaleBytes)}</span>
                  {job.chunks > 0 ? <span>{job.chunks} sezioni</span> : null}
                  {job.errori > 0 ? <span className="text-destructive">{job.errori} errori</span> : null}
                </div>
                {job.ultimoPath && !JOB_TERMINALI.has(job.stato) ? (
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {job.ultimoPath}
                  </p>
                ) : null}
                {job.errore ? <p className="text-xs text-destructive">{job.errore}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Cartella Nextcloud
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <FolderTree className="size-4 shrink-0 text-muted-foreground" />
                  {riga.nextcloudPath ? (
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                      /{riga.nextcloudPath}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      Nessuna cartella scelta
                    </span>
                  )}
                  {canManage && riga.nextcloudPath ? (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Svuota la cartella di ${ENTITA_LABEL[riga.entita]}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => aggiorna(riga.entita, { nextcloudPath: "" })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <NextcloudFolderPicker
                  value={riga.nextcloudPath}
                  disabled={!canManage}
                  browseUrl="/api/crm-settings/solair-ai/browse"
                  triggerLabel={riga.nextcloudPath ? "Cambia" : "Scegli cartella"}
                  title={`Cartella di ${ENTITA_LABEL[riga.entita]}`}
                  description="Naviga le tue cartelle Nextcloud e scegli con un click quella da cui SolairAI deve leggere."
                  onSelect={(path) => aggiorna(riga.entita, { nextcloudPath: path })}
                />
              </div>
              <p className="text-xs text-muted-foreground">{AIUTO[riga.entita]}</p>
            </div>
          </div>
          )
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        SolairAI conosce solo le fonti autorizzate qui. Dentro una fonte attiva scende in tutte
        le sottocartelle fino ai file, salva l&apos;impronta di modifica e rilegge solo cio&apos;
        che cambia.
      </p>
    </div>
  )
}
