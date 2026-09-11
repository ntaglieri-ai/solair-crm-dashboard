import { NextResponse } from "next/server"

import { getCurrentPermissions } from "@/lib/permissions/server"
import { leggiStatoIndiceSolairAI } from "@/lib/solair-ai/indice"
import { getSolairAiSyncJob, isSolairAiJobStallo } from "@/lib/solair-ai/sync-job-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const permissions = await getCurrentPermissions()
  if (!permissions.canAction("crm_settings.system.schema.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { jobId } = await context.params
  const job = await getSolairAiSyncJob(jobId)
  if (!job) {
    return NextResponse.json({ error: "Job non trovato." }, { status: 404 })
  }

  const stallo = isSolairAiJobStallo(job)
  return NextResponse.json(
    {
      job: stallo
        ? {
            ...job,
            stato: "error",
            errore:
              job.errore ??
              `Job fermo da oltre 2 minuti: ultimo file ${job.ultimoPath ?? "non disponibile"}.`,
          }
        : job,
      stato: await leggiStatoIndiceSolairAI(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
