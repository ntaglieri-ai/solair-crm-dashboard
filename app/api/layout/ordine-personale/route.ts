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
    .filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 120)
    .slice(0, MAX_ELEMENTI)
}

export async function PUT(request: Request) {
  let body: { modulo?: unknown; pagine?: unknown; blocchi?: unknown; campi?: unknown }
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

  /** Mappa contenitore -> elenco ordinato, scartando chiavi implausibili. */
  const mappaDiElenchi = (grezzo: unknown): Record<string, string[]> => {
    const risultato: Record<string, string[]> = {}
    if (!grezzo || typeof grezzo !== "object" || Array.isArray(grezzo)) return risultato
    for (const [chiave, elenco] of Object.entries(grezzo as Record<string, unknown>)) {
      if (typeof chiave !== "string" || chiave.length > 120) continue
      const chiavi = elencoDiChiavi(elenco)
      if (chiavi.length) risultato[chiave] = chiavi
    }
    return risultato
  }

  const blocchi = mappaDiElenchi(body.blocchi)
  const campi = mappaDiElenchi(body.campi)

  const supabase = await createClient()

  // Fusione con quanto gia' salvato invece di sostituzione: la scheda manda
  // solo la preferenza appena cambiata (un blocco spostato, un campo
  // spostato), e sovrascrivere l'intera riga cancellerebbe le altre due.
  const { data: corrente } = await supabase
    .from("crm_layout_ordine_utente")
    .select("ordine, ordine_blocchi, ordine_campi")
    .eq("utente_id", utenteId)
    .eq("modulo", body.modulo)
    .maybeSingle()

  const salvato = (corrente ?? {}) as {
    ordine?: unknown
    ordine_blocchi?: unknown
    ordine_campi?: unknown
  }
  const oggetto = (grezzo: unknown): Record<string, string[]> =>
    grezzo && typeof grezzo === "object" && !Array.isArray(grezzo)
      ? (grezzo as Record<string, string[]>)
      : {}

  const { error } = await supabase.from("crm_layout_ordine_utente").upsert(
    {
      utente_id: utenteId,
      modulo: body.modulo,
      ordine: body.pagine === undefined
        ? Array.isArray(salvato.ordine)
          ? salvato.ordine
          : []
        : pagine,
      ordine_blocchi: { ...oggetto(salvato.ordine_blocchi), ...blocchi },
      ordine_campi: { ...oggetto(salvato.ordine_campi), ...campi },
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
