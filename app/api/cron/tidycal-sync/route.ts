import { NextResponse } from "next/server"
import { syncTidyCalBookings } from "@/lib/tidycal/sync"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  try {
    const result = await syncTidyCalBookings()
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizzazione TidyCal fallita"
    console.error("[cron/tidycal-sync]", message)
    return NextResponse.json(
      { ok: false, latencyMs: Date.now() - started, error: message },
      { status: 500 },
    )
  }
}
