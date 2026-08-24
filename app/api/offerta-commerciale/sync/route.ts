import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"
import {
  accessoNextcloudUtente,
  sincronizzaOffertaCommerciale,
} from "@/lib/offerta-commerciale/sync"

/**
 * Sincronizzazione manuale del catalogo commerciale.
 *
 * La logica sta in lib/offerta-commerciale/sync.ts: la usa anche il server MCP,
 * che pero' non ha una sessione browser e quindi entra con le credenziali
 * admin. Qui si resta sull'app-password personale di chi ha premuto il
 * pulsante, com'e' sempre stato, e i listini nuovi vengono pubblicati subito.
 */
export async function POST() {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })

  try {
    const nextcloud = await commercialNextcloudUser(guard.permissions.snapshot.subject)
    const esito = await sincronizzaOffertaCommerciale(
      supabase,
      accessoNextcloudUtente(nextcloud.username, nextcloud.appPassword),
    )
    return NextResponse.json(esito)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizzazione Nextcloud fallita"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
