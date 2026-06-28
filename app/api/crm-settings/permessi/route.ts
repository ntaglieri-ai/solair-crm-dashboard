import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  PAGINE,
  MODULI_RECORD,
  RECORD_PERMESSI,
  type RuoloPermessi,
} from "@/lib/ruoli-data"

type PatchPayload = {
  ruoloId: string
  permessi: RuoloPermessi
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as PatchPayload | null
  if (!body?.ruoloId || !body.permessi) {
    return NextResponse.json({ error: "Payload non valido" }, { status: 400 })
  }

  const { ruoloId, permessi } = body
  const supabase = await createClient()

  // Pagine: una riga per ogni pagina con il relativo accesso (incl. revoche).
  const paginaRows = PAGINE.map((p) => ({
    ruolo_id: ruoloId,
    pagina: p.id,
    accesso: permessi.pagine[p.id] === true,
  }))

  // Record: una riga per ogni combinazione modulo×azione, abilitato true/false.
  const recordRows = MODULI_RECORD.flatMap((m) =>
    RECORD_PERMESSI.map((perm) => ({
      ruolo_id: ruoloId,
      modulo: m.id,
      azione: perm.id,
      abilitato: permessi.record[m.id].includes(perm.id),
    })),
  )

  // UI: scope sedi/cartelle ("all" => true) e flag riconfigurazioni.
  const uiRows = [
    {
      ruolo_id: ruoloId,
      chiave: "visibilita_sedi",
      abilitato: permessi.visibilita_sedi === "all",
    },
    {
      ruolo_id: ruoloId,
      chiave: "cartelle_nextcloud",
      abilitato: permessi.cartelle_nextcloud === "all",
    },
    {
      ruolo_id: ruoloId,
      chiave: "riconfigurazioni",
      abilitato: permessi.riconfigurazioni === true,
    },
  ]

  const [paginaRes, recordRes, uiRes] = await Promise.all([
    supabase
      .from("permessi_pagina")
      .upsert(paginaRows, { onConflict: "ruolo_id,pagina" }),
    supabase
      .from("permessi_record")
      .upsert(recordRows, { onConflict: "ruolo_id,modulo,azione" }),
    supabase
      .from("permessi_ui")
      .upsert(uiRows, { onConflict: "ruolo_id,chiave" }),
  ])

  const error = paginaRes.error ?? recordRes.error ?? uiRes.error
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
