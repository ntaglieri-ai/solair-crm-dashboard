import { NextResponse, after } from "next/server"

import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { requireApiAction } from "@/lib/permissions/server"
import { leggiImpostazioniAI, salvaImpostazioniAI } from "@/lib/solair-ai/settings"
import { isEntitaAI } from "@/lib/solair-ai/tipi"
import type { EntitaAI } from "@/lib/solair-ai/tipi"

export const dynamic = "force-dynamic"

type PutPayload = {
  impostazioni?: { entita?: string; nextcloudPath?: string; attivo?: boolean }[]
}

export async function GET() {
  // La sola lettura passa dal permesso di pagina delle impostazioni: chi
  // apre la pagina la vede, chi non la apre non la chiama.
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response
  return NextResponse.json({ impostazioni: await leggiImpostazioniAI() })
}

export async function PUT(request: Request) {
  // Stessa chiave che la RLS usa in solair_ai_can_configure(): se qui si
  // allentasse, il database direbbe comunque di no.
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as PutPayload | null
  const modifiche = (body?.impostazioni ?? [])
    .filter((riga) => isEntitaAI(riga?.entita))
    .map((riga) => ({
      entita: riga.entita as EntitaAI,
      nextcloudPath: typeof riga.nextcloudPath === "string" ? riga.nextcloudPath : "",
      attivo: riga.attivo !== false,
    }))

  if (modifiche.length === 0) {
    return NextResponse.json({ error: "Nessuna impostazione da salvare." }, { status: 400 })
  }

  try {
    await salvaImpostazioniAI(guard.permissions.snapshot.subject.userId, modifiche)
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Salvataggio non riuscito."
    console.error("[crm-settings/solair-ai]", messaggio)
    return NextResponse.json({ error: messaggio }, { status: 500 })
  }

  after(() =>
    logAudit({
      tipo_evento: "operazione_admin",
      attore: attoreDaPermessi(guard.permissions),
      descrizione:
        "SolairAI — cartelle Nextcloud aggiornate: " +
        modifiche
          .map((riga) => `${riga.entita}=${riga.nextcloudPath || "(vuota)"}`)
          .join(", "),
      request,
    }),
  )

  return NextResponse.json({ impostazioni: await leggiImpostazioniAI() })
}
