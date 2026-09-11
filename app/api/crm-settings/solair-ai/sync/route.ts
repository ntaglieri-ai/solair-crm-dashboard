import { NextResponse, after } from "next/server"

import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { requireApiAction } from "@/lib/permissions/server"
import {
  controllaIndiceSolairAI,
  leggiStatoIndiceSolairAI,
  preparaCodaSincronizzazioneSolairAI,
  processaBatchJobSolairAI,
} from "@/lib/solair-ai/indice"
import { isEntitaAI } from "@/lib/solair-ai/tipi"
import type { EntitaAI } from "@/lib/solair-ai/tipi"
import {
  createSolairAiSyncJob,
  finishSolairAiSyncJob,
  getActiveSolairAiSyncJobs,
  updateSolairAiSyncJob,
} from "@/lib/solair-ai/sync-job-store"
import { leggiImpostazioneAI } from "@/lib/solair-ai/settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

type Payload = {
  entita?: string
  force?: boolean
  operation?: "check" | "sync"
}

export async function GET() {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  return NextResponse.json({ stato: await leggiStatoIndiceSolairAI() })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as Payload | null
  const entita: EntitaAI | undefined = isEntitaAI(body?.entita) ? body.entita : undefined
  if (!entita) {
    return NextResponse.json({ error: "Entita' non valida." }, { status: 400 })
  }

  try {
    const operation = body?.operation === "check" ? "check" : "sync"
    const jobAperto = (await getActiveSolairAiSyncJobs()).find(
      (job) => job.entita === entita && job.modo === operation,
    )
    if (jobAperto) {
      return NextResponse.json(
        {
          job: jobAperto,
          jobId: jobAperto.id,
          stato: await leggiStatoIndiceSolairAI(),
          error: null,
        },
        { status: 202 },
      )
    }

    const impostazione = await leggiImpostazioneAI(entita)
    const { job, error: jobError } = await createSolairAiSyncJob({
      entita,
      modo: operation,
      sourcePath: impostazione.nextcloudPath,
      creatoDa: guard.permissions.snapshot.subject.userId,
    })

    if (jobError || !job) {
      return NextResponse.json({ error: jobError ?? "Creazione job non riuscita." }, { status: 500 })
    }

    const subject = guard.permissions.snapshot.subject
    const attore = attoreDaPermessi(guard.permissions)

    after(async () => {
      try {
        if (operation === "check") {
          const risultato = await controllaIndiceSolairAI({
            entita,
            subject,
            force: body?.force === true,
            onProgress: (progress) => updateSolairAiSyncJob(job.id, progress),
          })

          await finishSolairAiSyncJob(job.id, {
            errore: risultato.errors[0] ?? null,
            risultato,
            progress: {
              fase: "completed",
              scanned: risultato.scanned,
              totale: risultato.daAggiornare,
              processati: risultato.daAggiornare,
              daAggiornare: risultato.daAggiornare,
              invariati: risultato.invariati,
              cancellati: risultato.cancellati,
              errori: risultato.errors.length,
              warnings: risultato.warnings.length,
              totaleBytes: risultato.totaleBytes,
            },
          })

          await logAudit({
            tipo_evento: "operazione_admin",
            attore,
            descrizione: `SolairAI — check indice ${entita}: ${risultato.scanned} file, ${risultato.daAggiornare} da sincronizzare`,
            request,
          })
          return
        }

        const risultato = await preparaCodaSincronizzazioneSolairAI({
          jobId: job.id,
          entita,
          subject,
          force: body?.force === true,
        })

        if (risultato.errors.length > 0 || risultato.daAggiornare === 0) {
          await finishSolairAiSyncJob(job.id, {
            errore: risultato.errors[0] ?? null,
            risultato,
            progress: {
              fase: "completed",
              scanned: risultato.scanned,
              totale: risultato.daAggiornare,
              processati: 0,
              daAggiornare: risultato.daAggiornare,
              invariati: risultato.invariati,
              cancellati: risultato.cancellati,
              errori: risultato.errors.length,
              warnings: risultato.warnings.length,
              totaleBytes: risultato.totaleBytes,
            },
          })
        } else {
          await processaBatchJobSolairAI({ jobId: job.id, maxFiles: 8, maxMs: 50_000 })
        }

        await logAudit({
          tipo_evento: "operazione_admin",
          attore,
          descrizione: `SolairAI — sync indice accodata: ${entita} ${risultato.scanned} file, ${risultato.daAggiornare} da sincronizzare, ${risultato.cancellati} cancellati`,
          request,
        })
      } catch (errore) {
        const messaggio = errore instanceof Error ? errore.message : "Job SolairAI interrotto"
        console.error(`[crm-settings/solair-ai/sync] job ${job.id}`, messaggio)
        await finishSolairAiSyncJob(job.id, { errore: messaggio })
      }
    })

    return NextResponse.json(
      {
        job,
        jobId: job.id,
        stato: await leggiStatoIndiceSolairAI(),
        error: null,
      },
      { status: 202 },
    )
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Sincronizzazione non riuscita."
    console.error("[crm-settings/solair-ai/sync]", messaggio)
    return NextResponse.json({ error: messaggio }, { status: 500 })
  }
}
