import { NextResponse } from "next/server"
import { requireApiSuperadmin } from "@/lib/permissions/server"
import {
  leggiConsensoEnforcement,
  salvaConsensoEnforcement,
} from "@/lib/email/consent-enforcement"

// Endpoint storico: il blocco consenso non e' piu' operativo.

export async function GET() {
  const guard = await requireApiSuperadmin()
  if (guard.response) return guard.response

  const { attivo, errore } = await leggiConsensoEnforcement()
  return NextResponse.json(
    { attivo, errore },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function PUT(request: Request) {
  const guard = await requireApiSuperadmin()
  if (guard.response) return guard.response

  const payload = (await request.json().catch(() => null)) as { attivo?: unknown } | null
  if (typeof payload?.attivo !== "boolean") {
    return NextResponse.json(
      { error: "Il campo 'attivo' deve essere true o false." },
      { status: 400 },
    )
  }

  const { attivo: precedente } = await leggiConsensoEnforcement()

  const { errore } = await salvaConsensoEnforcement(false)
  if (errore) return NextResponse.json({ error: errore }, { status: 500 })

  return NextResponse.json({ attivo: false, cambiato: precedente !== false })
}
