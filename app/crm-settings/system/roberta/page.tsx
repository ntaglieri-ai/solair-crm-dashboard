"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { usePermissions } from "@/lib/permissions/provider"
import { deriveRobertaHealth } from "@/lib/roberta/health"

type KnowledgeStatus = {
  sources: number
  chunks: number
  catalogItems: number
  lastSync: {
    ok: boolean
    syncedAt: string
    error: string | null
  } | null
  recentSources: {
    nome: string
    cartella: string
    stato: "ready" | "scan_pending" | "empty" | "error"
    testo_chars: number
    synced_at: string
    errore: string | null
  }[]
}

type SyncResult = {
  sources: number
  updated: number
  reused: number
  chunks: number
  catalogItems: number
  scansPending: number
  errors: string[]
}

export default function RobertaKnowledgePage() {
  const permissions = usePermissions()
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const health = deriveRobertaHealth(status)
  const roleCode = permissions.snapshot.subject.ruoloCode
  const isSuperadmin = permissions.isSuperadmin
  const canSeeStatus = isSuperadmin || roleCode === "ADMIN"

  async function loadStatus(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
        cache: "no-store",
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? "Errore stato RobertaBot")
      setStatus(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore stato RobertaBot")
    } finally {
      setLoading(false)
    }
  }

  async function sync(force = false) {
    setSyncing(true)
    try {
      const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const body = (await response.json()) as SyncResult & { error?: string }
      if (!response.ok) throw new Error(body.error ?? "Errore aggiornamento RobertaBot")

      toast.success(
        `RobertaBot aggiornato: ${body.updated} documenti aggiornati, ${body.reused} invariati`,
      )
      if (body.errors.length > 0) {
        toast.warning(`${body.errors.length} avvisi durante la sincronizzazione`)
      }
      await loadStatus()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Errore aggiornamento RobertaBot",
      )
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const response = await fetch("/api/crm-settings/roberta/knowledge/sync", {
          cache: "no-store",
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error ?? "Errore stato RobertaBot")
        if (!cancelled) setStatus(body)
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Errore stato RobertaBot")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!canSeeStatus) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeader
          title="RobertaBot"
          description="Stato tecnico della conoscenza indicizzata."
        />
        <section className="rounded-lg border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
          Stato RobertaBot non disponibile per questo profilo.
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="RobertaBot"
        description="Stato tecnico della conoscenza indicizzata e comandi di sincronizzazione."
        action={isSuperadmin ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => sync(true)} disabled={syncing}>
              <RotateCcw className="size-4" />
              Ricostruisci
            </Button>
            <Button onClick={() => sync(false)} disabled={syncing}>
              <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
              Aggiorna
            </Button>
          </div>
        ) : null}
      />

      <HealthPanel
        level={health.level}
        label={loading ? "Controllo" : health.label}
        summary={loading ? "Lettura stato RobertaBot" : health.summary}
        alarms={isSuperadmin ? health.alarms : []}
        showAlarms={isSuperadmin}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={Database}
          label="Documenti"
          value={loading ? "..." : String(status?.sources ?? 0)}
        />
        <MetricCard
          icon={Search}
          label="Blocchi conoscenza"
          value={loading ? "..." : String(status?.chunks ?? 0)}
        />
        <MetricCard
          icon={Bot}
          label="Ultimo controllo"
          value={loading ? "..." : formatLastSync(status?.lastSync?.syncedAt)}
        />
      </div>
    </div>
  )
}

function formatLastSync(value: string | null | undefined) {
  if (!value) return "Mai"
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function HealthPanel({
  level,
  label,
  summary,
  alarms,
  showAlarms,
}: {
  level: "green" | "yellow" | "red"
  label: string
  summary: string
  alarms: string[]
  showAlarms: boolean
}) {
  const tone = {
    green: {
      border: "border-teal/25",
      bg: "bg-teal/10",
      text: "text-teal",
      dot: "bg-teal",
      icon: CheckCircle2,
    },
    yellow: {
      border: "border-warning/30",
      bg: "bg-warning/10",
      text: "text-warning",
      dot: "bg-warning",
      icon: AlertTriangle,
    },
    red: {
      border: "border-destructive/25",
      bg: "bg-destructive/10",
      text: "text-destructive",
      dot: "bg-destructive",
      icon: AlertTriangle,
    },
  }[level]
  const Icon = tone.icon

  return (
    <section className={`rounded-lg border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex size-16 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-border">
            <span className={`size-9 rounded-full ${tone.dot} shadow-[0_0_0_8px_color-mix(in_srgb,currentColor_12%,transparent)]`} />
          </div>
          <div>
            <p className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${tone.text}`}>
              <Icon className="size-4" />
              {label}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{summary}</h2>
          </div>
        </div>
        <Badge variant="outline" className={`w-fit bg-card ${tone.text}`}>
          Stato RobertaBot
        </Badge>
      </div>

      {showAlarms && alarms.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">Allarmi rilevati</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {alarms.map((alarm) => (
              <li key={alarm} className="flex gap-2">
                <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${tone.text}`} />
                <span>{alarm}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showAlarms && alarms.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-teal">Nessun allarme rilevato.</p>
      ) : null}
    </section>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database
  label: string
  value: string
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </article>
  )
}
