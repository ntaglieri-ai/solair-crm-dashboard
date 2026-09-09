import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { isLayoutModulo } from "@/lib/crm-settings/layout-validate"

/**
 * Ordine personale delle sezioni di una scheda.
 *
 * Non e' configurazione: la struttura (quali pagine e blocchi esistono, cosa
 * contengono) resta dell'admin, qui si salva solo in che ordine il singolo
 * utente li vede mentre lavora. Per questo non serve il permesso sulla
 * pagina Layout — basta essere autenticati, e ciascuno scrive solo la
 * propria riga, cosa che la RLS impone comunque.
 */

const MAX_ELEMENTI = 200

function elencoDiChiavi(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 63)
    .slice(0, MAX_ELEMENTI)
}

export async function PUT(request: Request) {
  let body: { modulo?: unknown; pagine?: unknown; blocchi?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corpo richiesta non valido" }, { status: 400 })
  }

  if (!isLayoutModulo(body.modulo)) {
    return NextResponse.json({ error: "Modulo non valido" }, { status: 400 })
  }

  const permissions = await getCurrentPermissions()
  const utenteId = permissions.snapshot.subject.userId
  if (!utenteId) {
    return NextResponse.json({ error: "Utente non riconosciuto" }, { status: 401 })
  }

  const pagine = elencoDiChiavi(body.pagine)

  const blocchi: Record<string, string[]> = {}
  if (body.blocchi && typeof body.blocchi === "object" && !Array.isArray(body.blocchi)) {
    for (const [pageKey, elenco] of Object.entries(body.blocchi as Record<string, unknown>)) {
      if (typeof pageKey !== "string" || pageKey.length > 63) continue
      const chiavi = elencoDiChiavi(elenco)
      if (chiavi.length) blocchi[pageKey] = chiavi
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("crm_layout_ordine_utente").upsert(
    {
      utente_id: utenteId,
      modulo: body.modulo,
      ordine: pagine,
      ordine_blocchi: blocchi,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "utente_id,modulo" },
  )

  if (error) {
    // Una preferenza di visualizzazione non deve diventare un errore
    // bloccante: si registra e si va avanti, l'utente rivedra' l'ordine
    // dell'admin al prossimo caricamento.
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
