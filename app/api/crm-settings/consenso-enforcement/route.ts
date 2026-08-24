import { NextResponse, after } from "next/server"
import { requireApiSuperadmin } from "@/lib/permissions/server"
import { attoreDaPermessi } from "@/lib/audit/log"
import {
  leggiConsensoEnforcement,
  salvaConsensoEnforcement,
} from "@/lib/email/consent-enforcement"
import { logCambioEnforcement } from "@/lib/email/consent"

// Interruttore globale del blocco invii senza consenso.
//
// SUPERADMIN su ENTRAMBI i verbi, non solo sulla scrittura: sapere che il
// blocco e' spento e' gia' un'informazione operativa sensibile. Gli agenti la
// ricevono comunque, ma solo dove serve loro — l'avviso nel dialog di invio,
// che arriva da /api/email-massa/preview.

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
  const nuovo = payload.attivo

  // Stato precedente letto PRIMA della scrittura: e' meta' dell'evento di
  // audit, e dopo l'upsert non sarebbe piu' recuperabile.
  const { attivo: precedente } = await leggiConsensoEnforcement()

  const { errore } = await salvaConsensoEnforcement(nuovo)
  if (errore) return NextResponse.json({ error: errore }, { status: 500 })

  // Si registra solo il cambio reale: un salvataggio che non cambia nulla non
  // e' un evento, e riempire il registro di non-eventi lo rende illeggibile.
  if (precedente !== nuovo) {
    const attore = attoreDaPermessi(guard.permissions)
    after(() => logCambioEnforcement({ precedente, nuovo, attore, request }))
  }

  return NextResponse.json({ attivo: nuovo, cambiato: precedente !== nuovo })
}
