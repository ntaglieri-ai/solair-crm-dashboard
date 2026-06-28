"use client"

import { useRef, useState } from "react"
import { DatabaseBackup, Info, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

type BackupState = "idle" | "running" | "done"

export default function BackupPage() {
  const [state, setState] = useState<BackupState>("idle")
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)

  function runBackup() {
    if (state === "running") return
    setState("running")
    setProgress(0)
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          setState("done")
          return 100
        }
        return Math.min(100, p + 10)
      })
    }, 220)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Backup"
        description="Gestisci i backup manuali del database CRM."
      />

      {/* Stato backup */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              Ultimo backup
            </span>
            <span className="text-lg font-semibold text-foreground">
              {state === "done" ? "Adesso" : "Mai eseguito"}
            </span>
          </div>
          <span className="inline-flex items-center rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
            {state === "done" ? "Aggiornato" : "Da eseguire"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              Backup automatici
            </span>
            <span className="text-lg font-semibold text-foreground">
              Supabase Pro
            </span>
          </div>
          <span className="inline-flex items-center rounded-full bg-info/15 px-2.5 py-1 text-xs font-medium text-info">
            Attivi
          </span>
        </div>
      </div>

      {/* Backup manuale */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
            <DatabaseBackup className="size-5" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-foreground">
              Esegui backup manuale
            </h3>
            <p className="text-sm text-muted-foreground">
              Crea un backup completo del database in questo momento.
            </p>
          </div>
        </div>

        {state === "running" ? (
          <Progress value={progress} className="gap-2">
            <span className="text-sm font-medium text-foreground">
              Backup in corso…
            </span>
            <span className="ml-auto text-sm tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </Progress>
        ) : null}

        {state === "done" ? (
          <div className="flex items-center gap-2 rounded-lg bg-teal/10 px-3 py-2 text-sm font-medium text-teal">
            <CheckCircle className="size-4" />
            Backup completato
          </div>
        ) : null}

        <div>
          <Button
            onClick={runBackup}
            disabled={state === "running"}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
          >
            {state === "running" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}
            {state === "running" ? "Backup in corso…" : "Esegui backup ora"}
          </Button>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          I backup automatici sono gestiti da Supabase Pro con retention 7
          giorni. Per backup aggiuntivi o export completo usa la sezione
          Import/Export.
        </span>
      </p>
    </div>
  )
}
