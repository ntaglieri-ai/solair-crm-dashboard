import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { unlink, writeFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  runClientiDryRun,
  runCompitiDryRun,
  runInstallatoriDryRun,
  runLeadDryRun,
  runScadenzeDryRun,
} from "@/lib/zoho-sync/runner"
import type { SupabaseLike, ZohoSyncModule, ZohoSyncRunResult } from "@/lib/zoho-sync/types"

export const runtime = "nodejs"

const ALLOWED_ROLES = new Set(["SUPERADMIN", "ADMIN"])
const MAX_CSV_BYTES = 40 * 1024 * 1024

const RUNNERS: Record<
  ZohoSyncModule,
  (options: { csvPath: string; supabase: SupabaseLike; logToDatabase?: boolean }) => Promise<ZohoSyncRunResult>
> = {
  leads: runLeadDryRun,
  clienti: runClientiDryRun,
  compiti: runCompitiDryRun,
  scadenze: runScadenzeDryRun,
  installatori: runInstallatoriDryRun,
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "zoho.csv"
}

function summarizeResult(result: ZohoSyncRunResult, module: ZohoSyncModule) {
  return {
    mode: "dry_run",
    module,
    databaseLogging: true,
    operativeWrites: false,
    runId: result.runId,
    stats: result.stats,
    sampleEvents: result.events.slice(0, 50).map((event) => ({
      action: event.action,
      zohoId: event.zohoId,
      crmRecordId: event.crmRecordId,
      diffCount: event.diffs.length,
      error: event.error,
      payloadSummary: event.payloadSummary,
    })),
  }
}

export async function POST(request: Request) {
  const guard = await requireApiPage("crm_settings.system.zoho_t0")
  if (guard.response) return guard.response

  const role = guard.permissions.snapshot.subject.ruoloCode.toUpperCase()
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await request.formData()
  const mode = String(formData.get("mode") ?? "dry_run")
  const zohoModule = String(formData.get("module") ?? "") as ZohoSyncModule
  const file = formData.get("file")

  if (mode !== "dry_run") {
    return NextResponse.json(
      {
        error:
          "Import definitivo non attivo: il motore Zoho T0 disponibile nel CRM e' dry-run only.",
      },
      { status: 501 },
    )
  }

  if (!Object.hasOwn(RUNNERS, zohoModule)) {
    return NextResponse.json({ error: "Modulo Zoho non valido" }, { status: 400 })
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Carica un CSV Zoho valido" }, { status: 400 })
  }

  if (file.size > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "CSV troppo grande per l'import web" }, { status: 413 })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client non configurato" },
      { status: 503 },
    )
  }

  const tmpPath = path.join(
    tmpdir(),
    `zoho-t0-${randomUUID()}-${safeFileName(file.name)}`,
  )

  try {
    await writeFile(tmpPath, Buffer.from(await file.arrayBuffer()))
    const result = await RUNNERS[zohoModule]({
      csvPath: tmpPath,
      supabase,
      logToDatabase: true,
    })
    return NextResponse.json(summarizeResult(result, zohoModule))
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Dry-run Zoho T0 non riuscito",
      },
      { status: 500 },
    )
  } finally {
    await unlink(tmpPath).catch(() => {})
  }
}
