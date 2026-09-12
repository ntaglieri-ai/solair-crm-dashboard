import { NextResponse } from "next/server"

import { processaBatchJobSolairAI } from "@/lib/solair-ai/indice"
import { finishSolairAiSyncJob, getOpenSolairAiSyncJobs } from "@/lib/solair-ai/sync-job-store"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Budget di lavoro dentro i 300s della funzione, con un margine per chiudere
 * i conti (rilascio dei file presi e non lavorati, statistiche finali).
 */
const BUDGET_MS = 265_000

function solairAiCronEnabled() {
  return process.env.SOLAIR_AI_CRON_ENABLED === "true"
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!solairAiCronEnabled()) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "SOLAIR_AI_CRON_ENABLED non attivo: worker SolairAI fermo.",
    })
  }

  const started = Date.now()
  const results: Array<{ jobId: string; processed: number; done: boolean; error: string | null }> = []

  try {
    const jobs = await getOpenSolairAiSyncJobs(2)
    for (const job of jobs) {
      const rimanente = BUDGET_MS - (Date.now() - started)
      // Sotto i 20 secondi non vale la pena prendere in carico altri file:
      // si finirebbe per rilasciarli subito.
      if (rimanente < 20_000) break
      try {
        // Nessun tetto sul numero di file: a fermare il giro e' il tempo.
        // Il vecchio `maxFiles: 10` faceva finire la funzione dopo dieci
        // file e poi aspettare cinque minuti il cron successivo — con una
        // coda da 25.000 file voleva dire due file al minuto, cioe' giorni.
        results.push(
          await processaBatchJobSolairAI({ jobId: job.id, maxFiles: 100_000, maxMs: rimanente }),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : "Job SolairAI interrotto"
        console.error(`[cron/solair-ai-sync] job ${job.id}`, message)
        await finishSolairAiSyncJob(job.id, { errore: message })
        results.push({ jobId: job.id, processed: 0, done: true, error: message })
      }
    }

    return NextResponse.json({
      ok: results.every((result) => !result.error),
      latencyMs: Date.now() - started,
      jobs: results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sync SolairAI"
    console.error("[cron/solair-ai-sync]", message)
    return NextResponse.json(
      { ok: false, latencyMs: Date.now() - started, error: message },
      { status: 500 },
    )
  }
}
