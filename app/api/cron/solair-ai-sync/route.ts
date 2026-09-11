import { NextResponse } from "next/server"

import { processaBatchJobSolairAI } from "@/lib/solair-ai/indice"
import { finishSolairAiSyncJob, getOpenSolairAiSyncJobs } from "@/lib/solair-ai/sync-job-store"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  const results: Array<{ jobId: string; processed: number; done: boolean; error: string | null }> = []

  try {
    const jobs = await getOpenSolairAiSyncJobs(2)
    for (const job of jobs) {
      if (Date.now() - started > 100_000) break
      try {
        results.push(await processaBatchJobSolairAI({ jobId: job.id, maxFiles: 10, maxMs: 45_000 }))
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
