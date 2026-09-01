import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { puoGestireCategorie } from "@/lib/calendario/types"
import { syncTidyCalBookings } from "@/lib/tidycal/sync"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST() {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response
  if (!puoGestireCategorie(guard.permissions.snapshot.subject.ruoloCode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await syncTidyCalBookings()) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizzazione TidyCal fallita"
    console.error("[calendario/tidycal/sync]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
