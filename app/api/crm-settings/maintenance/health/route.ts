import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { basicAuth, nextcloudAdminConfig, ocsHeaders } from "@/lib/nextcloud/config"

type HealthStatus = "operational" | "degraded" | "unconfigured"

type HealthService = {
  id: string
  label: string
  status: HealthStatus
  latencyMs: number | null
  detail: string
}

async function timed<T>(operation: () => Promise<T>) {
  const started = Date.now()
  const value = await operation()
  return { value, latencyMs: Date.now() - started }
}

export async function GET() {
  const guard = await requireApiAction("maintenance.view")
  if (guard.response) return guard.response
  if (!guard.permissions.isSuperadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabase = await createClient()
  const services: HealthService[] = []

  try {
    const { value, latencyMs } = await timed(async () =>
      await supabase.from("utenti").select("id", { head: true, count: "exact" }),
    )
    services.push({
      id: "database",
      label: "Database Supabase",
      status: value.error ? "degraded" : "operational",
      latencyMs,
      detail: value.error ? value.error.message : "Connessione e query disponibili",
    })
  } catch {
    services.push({
      id: "database",
      label: "Database Supabase",
      status: "degraded",
      latencyMs: null,
      detail: "Connessione non disponibile",
    })
  }

  const admin = createAdminClient()
  if (admin) {
    try {
      const { value, latencyMs } = await timed(() => admin.storage.listBuckets())
      services.push({
        id: "storage",
        label: "Supabase Storage",
        status: value.error ? "degraded" : "operational",
        latencyMs,
        detail: value.error
          ? value.error.message
          : `${value.data.length} bucket disponibili`,
      })
    } catch {
      services.push({
        id: "storage",
        label: "Supabase Storage",
        status: "degraded",
        latencyMs: null,
        detail: "Verifica storage non riuscita",
      })
    }
  } else {
    services.push({
      id: "storage",
      label: "Supabase Storage",
      status: "unconfigured",
      latencyMs: null,
      detail: "Chiave server non configurata",
    })
  }

  const nextcloudSetting = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "maintenance.nextcloud")
    .maybeSingle()
  const nextcloudValue =
    nextcloudSetting.data?.valore &&
    typeof nextcloudSetting.data.valore === "object"
      ? (nextcloudSetting.data.valore as { url?: string })
      : null
  const nextcloudUrl = nextcloudValue?.url || process.env.NEXTCLOUD_URL
  if (nextcloudUrl) {
    try {
      const { value, latencyMs } = await timed(() =>
        fetch(nextcloudUrl, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }),
      )
      services.push({
        id: "nextcloud",
        label: "Nextcloud",
        status: value.ok || value.status === 401 ? "operational" : "degraded",
        latencyMs,
        detail: `Risposta HTTP ${value.status}`,
      })
    } catch {
      services.push({
        id: "nextcloud",
        label: "Nextcloud",
        status: "degraded",
        latencyMs: null,
        detail: "Endpoint non raggiungibile",
      })
    }
  } else {
    services.push({
      id: "nextcloud",
      label: "Nextcloud",
      status: "unconfigured",
      latencyMs: null,
      detail: "Endpoint non configurato",
    })
  }

  // Verifica separatamente le credenziali tecniche usate da provisioning,
  // password e gestione account. La GET e' di sola lettura e non espone dati
  // o segreti nella risposta del CRM.
  const nextcloudAdmin = nextcloudAdminConfig()
  if (nextcloudAdmin) {
    try {
      const { value, latencyMs } = await timed(() =>
        fetch(
          `${nextcloudAdmin.baseUrl}/ocs/v2.php/cloud/users/${encodeURIComponent(nextcloudAdmin.adminUser)}?format=json`,
          {
            headers: ocsHeaders({
              Authorization: basicAuth(
                nextcloudAdmin.adminUser,
                nextcloudAdmin.adminPassword,
              ),
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          },
        ),
      )
      const payload = (await value.json().catch(() => null)) as {
        ocs?: { meta?: { statuscode?: number; message?: string } }
      } | null
      const statusCode = payload?.ocs?.meta?.statuscode
      const ok = value.ok && (statusCode === 100 || statusCode === 200)
      services.push({
        id: "nextcloud-ocs",
        label: "Nextcloud OCS",
        status: ok ? "operational" : "degraded",
        latencyMs,
        detail: ok
          ? "Autenticazione tecnica disponibile"
          : `Autenticazione tecnica rifiutata${statusCode ? ` (OCS ${statusCode})` : ""}`,
      })
    } catch {
      services.push({
        id: "nextcloud-ocs",
        label: "Nextcloud OCS",
        status: "degraded",
        latencyMs: null,
        detail: "Verifica autenticazione tecnica non riuscita",
      })
    }
  } else {
    services.push({
      id: "nextcloud-ocs",
      label: "Nextcloud OCS",
      status: "unconfigured",
      latencyMs: null,
      detail: "Credenziali tecniche non configurate",
    })
  }

  const make = await supabase
    .from("crm_settings")
    .select("valore")
    .eq("chiave", "company.integrations.make")
    .maybeSingle()
  const makeConnections = Array.isArray(make.data?.valore) ? make.data.valore : []
  services.push({
    id: "make",
    label: "Integrazioni Make",
    status:
      make.error
        ? "degraded"
        : makeConnections.length > 0
          ? "operational"
          : "unconfigured",
    latencyMs: null,
    detail: make.error
      ? make.error.message
      : `${makeConnections.length} connessioni configurate`,
  })

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services,
  })
}
