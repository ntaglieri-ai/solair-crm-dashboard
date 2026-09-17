import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiAction } from "@/lib/permissions/server"
import { migraDefinizioneTutti } from "@/lib/crm-settings/migra-definizione-campi"
import { seedTuttiIValori } from "@/lib/crm-settings/seed-column-values"

/**
 * Le due migrazioni una-tantum che portano i dati esistenti nel nuovo assetto:
 *
 *  - `valori`      materializza in crm_column_values i valori predefiniti che
 *                  finora vivevano solo nel codice, e che quindi nessuno
 *                  riusciva a cancellare o rinominare.
 *  - `definizioni` sposta formula, sola lettura e formato da crm_layout_campi
 *                  a crm_custom_fields: dal piazzamento del campo al campo.
 *
 * Sta qui e non in uno script .mjs perche' entrambe hanno bisogno di costanti
 * TypeScript (i valori predefiniti, i ponti fra chiavi applicative e nomi di
 * colonna) che uno script Node non puo' importare senza duplicarle. Duplicarle
 * significherebbe trascriverle a mano: e' il tipo di copia che si sbaglia in
 * silenzio e sposta una formula sulla colonna sbagliata.
 *
 * In prova per default. Scrive solo con `apply: true` nel corpo, cosi' si
 * guarda cosa cambierebbe prima di cambiarlo.
 */
export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.system.schema.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as
    | { azione?: string; apply?: boolean }
    | null
  const azione = body?.azione ?? "tutto"
  const apply = body?.apply === true

  if (!["valori", "definizioni", "tutto"].includes(azione)) {
    return NextResponse.json(
      { error: "Azione non valida: usa valori, definizioni o tutto" },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  }

  try {
    const valori =
      azione === "valori" || azione === "tutto"
        ? await seedTuttiIValori(supabase, { apply })
        : null
    const definizioni =
      azione === "definizioni" || azione === "tutto"
        ? await migraDefinizioneTutti(supabase, { apply })
        : null

    return NextResponse.json({
      apply,
      // Il totale in chiaro: leggere "37 valori da creare" e' piu' utile che
      // contare a mano le righe dei due elenchi.
      riepilogo: {
        valori_da_creare: valori?.reduce((tot, e) => tot + e.creati.length, 0) ?? null,
        valori_gia_presenti: valori?.reduce((tot, e) => tot + e.gia_presenti, 0) ?? null,
        definizioni_da_spostare:
          definizioni?.reduce((tot, e) => tot + e.spostati.length, 0) ?? null,
        definizioni_non_risolte:
          definizioni?.reduce((tot, e) => tot + e.nonRisolti.length, 0) ?? null,
      },
      valori,
      definizioni,
    })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Migrazione non riuscita"
    console.error("[crm-settings/schema/migrazione]", messaggio)
    return NextResponse.json({ error: messaggio }, { status: 500 })
  }
}
