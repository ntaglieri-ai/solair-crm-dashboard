import { NextResponse } from "next/server"
import { runRobertaKnowledgeSync } from "@/lib/roberta/sync-runner"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  try {
    const result = await runRobertaKnowledgeSync()
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore sync RobertaBot"
    console.error("[cron/roberta-sync]", message)
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - started,
        error: message,
      },
      { status: 500 },
    )
  }
}
