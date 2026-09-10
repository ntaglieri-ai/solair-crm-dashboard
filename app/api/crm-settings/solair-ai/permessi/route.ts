import { NextResponse, after } from "next/server"

import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { invalidateRolePermissionCache } from "@/lib/permissions/load-permissions"
import { requireApiAction } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * I tre permessi di SolairAI, per ruolo.
 *
 * Sono scritti da questa pagina e da nessun'altra: `solair_ai` non compare in
 * PAGINE (lib/ruoli-data.ts), quindi il salvataggio della pagina "Ruoli e
 * permessi" non lo tocca. E' voluto — quel salvataggio riscrive TUTTE le
 * righe di PAGINE ogni volta, e una voce presente in due pannelli finirebbe
 * per essere azzerata da chi sta configurando tutt'altro.
 */

/** La riga "vede la voce di menu" e' un accesso di pagina, non un'azione. */
const PAGINA_MENU = "solair_ai"

const AZIONI = ["solair_ai.run", "solair_ai.revisioni.view"] as const
type AzioneSolairAI = (typeof AZIONI)[number]

export type PermessiSolairAiPerRuolo = {
  ruoloId: string
  menu: boolean
  run: boolean
  revisioni: boolean
}

type PutPayload = { permessi?: Partial<PermessiSolairAiPerRuolo>[] }

export async function GET() {
  const guard = await requireApiAction("crm_settings.account.roles.manage")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const [{ data: pagine }, { data: azioni }] = await Promise.all([
    supabase
      .from("permessi_pagina")
      .select("ruolo_id, accesso")
      .eq("pagina", PAGINA_MENU),
    supabase
      .from("permessi_azione")
      .select("ruolo_id, azione, abilitato")
      .in("azione", [...AZIONI]),
  ])

  const menu = new Map(
    ((pagine ?? []) as { ruolo_id: string; accesso: string | boolean | null }[]).map((riga) => [
      riga.ruolo_id,
      riga.accesso === true || riga.accesso === "r" || riga.accesso === "rw",
    ]),
  )
  const perAzione = new Map<string, boolean>()
  for (const riga of (azioni ?? []) as {
    ruolo_id: string
    azione: string
    abilitato: boolean
  }[]) {
    perAzione.set(`${riga.ruolo_id}|${riga.azione}`, riga.abilitato === true)
  }

  return NextResponse.json({ menu: [...menu], azioni: [...perAzione] })
}

export async function PUT(request: Request) {
  const guard = await requireApiAction("crm_settings.account.roles.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as PutPayload | null
  const righe = (body?.permessi ?? []).filter(
    (riga): riga is PermessiSolairAiPerRuolo => typeof riga?.ruoloId === "string",
  )
  if (righe.length === 0) {
    return NextResponse.json({ error: "Nessun permesso da salvare." }, { status: 400 })
  }

  const supabase = await createClient()

  const paginaRows = righe.map((riga) => ({
    ruolo_id: riga.ruoloId,
    pagina: PAGINA_MENU,
    accesso: riga.menu === true ? "rw" : "no_access",
  }))

  const azioneRows = righe.flatMap((riga) =>
    (
      [
        ["solair_ai.run", riga.run === true],
        ["solair_ai.revisioni.view", riga.revisioni === true],
      ] as [AzioneSolairAI, boolean][]
    ).map(([azione, abilitato]) => ({ ruolo_id: riga.ruoloId, azione, abilitato })),
  )

  const pagina = await supabase
    .from("permessi_pagina")
    .upsert(paginaRows, { onConflict: "ruolo_id,pagina" })
  if (pagina.error) {
    console.error("[crm-settings/solair-ai/permessi] pagina:", pagina.error.message)
    return NextResponse.json({ error: "Salvataggio non riuscito. Riprova." }, { status: 500 })
  }

  const azione = await supabase
    .from("permessi_azione")
    .upsert(azioneRows, { onConflict: "ruolo_id,azione" })
  if (azione.error) {
    console.error("[crm-settings/solair-ai/permessi] azione:", azione.error.message)
    return NextResponse.json({ error: "Salvataggio non riuscito. Riprova." }, { status: 500 })
  }

  // Senza invalidazione lo snapshot in cache resta quello vecchio fino al TTL:
  // l'amministratore vedrebbe la spunta salvata e l'utente il vecchio accesso.
  for (const riga of righe) invalidateRolePermissionCache(riga.ruoloId)

  after(() =>
    logAudit({
      tipo_evento: "operazione_admin",
      attore: attoreDaPermessi(guard.permissions),
      modulo: "permessi",
      descrizione: `SolairAI — permessi aggiornati su ${righe.length} ruoli`,
      request,
    }),
  )

  return NextResponse.json({ ok: true })
}
