"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, CheckCircle2, CircleAlert, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"

type Service = {
  id: string
  label: string
  status: "operational" | "degraded" | "unconfigured"
  latencyMs: number | null
  detail: string
}

export default function HealthPage() {
  const [services, setServices] = useState<Service[]>([])
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/crm-settings/maintenance/health", {
        cache: "no-store",
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Verifica non riuscita")
      setServices(payload.services)
      setCheckedAt(payload.checkedAt)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verifica non riuscita")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Health check"
        description={
          checkedAt
            ? `Ultimo controllo ${new Date(checkedAt).toLocaleString("it-IT")}`
            : "Controllo dello stato dei servizi collegati al CRM."
        }
        action={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Verifica ora
          </Button>
        }
      />
      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <article
            key={service.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                service.status === "operational" && "bg-success/10 text-success",
                service.status === "degraded" && "bg-destructive/10 text-destructive",
                service.status === "unconfigured" && "bg-warning/10 text-warning",
              )}
            >
              {service.status === "operational" ? (
                <CheckCircle2 className="size-5" />
              ) : service.status === "degraded" ? (
                <CircleAlert className="size-5" />
              ) : (
                <Activity className="size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{service.label}</h2>
                {service.latencyMs !== null ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {service.latencyMs} ms
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{service.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
