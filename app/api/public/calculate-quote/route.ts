import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  calcolaPreventivo,
  ErrorePreventivo,
  type CatalogoPerCalcolo,
} from "@/lib/offerta-commerciale/calcola-preventivo"
import {
  normalizeAccumuli,
  normalizeCodiciSconto,
  normalizeFotovoltaico,
  normalizeSconti,
} from "@/lib/offerta-commerciale/store"
import { corsHeaders } from "@/lib/public/cors"

/**
 * Preventivo indicativo per il configuratore del sito.
 *
 * Nessuna sessione CRM (il middleware esclude /api/public/*): ci si autentica
 * con una API key statica in Authorization: Bearer, stesso schema di
 * /api/public/listino ma con chiave dedicata — CALCULATE_QUOTE_KEY — cosi' i
 * due consumatori si possono ruotare o revocare separatamente.
 *
 * La chiave va tenuta lato server: qui si espone il listino combinazione per
 * combinazione, quindi la chiamata deve partire dal backend del sito, non dal
 * browser del visitatore. Gli header CORS restano per gli ambienti che
 * proxano la richiesta da un origin in allowlist.
 *
 * Si legge sempre e solo il catalogo `pubblicato`, mai le bozze.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const METODI = "POST, OPTIONS"
const HEADER_AMMESSI = "Content-Type, Authorization"

type CorpoRichiesta = {
  kwp?: unknown
  batteria_marca?: unknown
  batteria_kwh?: unknown
  zona?: unknown
  eps?: unknown
  eps_gift?: unknown
  codice_sconto?: unknown
}

function numero(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Il preflight non porta l'Authorization: resta senza autenticazione, come
// vuole il protocollo.
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request, METODI, HEADER_AMMESSI),
  })
}

export async function POST(request: Request) {
  const headers = {
    ...corsHeaders(request, METODI, HEADER_AMMESSI),
    "Cache-Control": "no-store",
  }
  const errore = (message: string, status: number, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: false, error: message, ...extra }, { status, headers })

  const expectedKey = process.env.CALCULATE_QUOTE_KEY
  if (!expectedKey) {
    console.error("[calculate-quote] CALCULATE_QUOTE_KEY non configurata")
    return errore("Sorgente non configurata", 503)
  }
  const providedKey = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (providedKey !== expectedKey) {
    return errore("Non autorizzato", 401)
  }

  const body = (await request.json().catch(() => null)) as CorpoRichiesta | null
  if (!body || typeof body !== "object") {
    return errore("Corpo della richiesta non valido: atteso un oggetto JSON.", 400)
  }

  const kwp = numero(body.kwp)
  const batteriaKwh = numero(body.batteria_kwh)
  const marca = typeof body.batteria_marca === "string" ? body.batteria_marca.trim() : ""
  const zona = typeof body.zona === "string" ? body.zona.trim() : ""
  const codiceSconto = typeof body.codice_sconto === "string" ? body.codice_sconto : null

  if (kwp == null || kwp <= 0) return errore("Campo \"kwp\" mancante o non numerico.", 400)
  if (!marca) return errore("Campo \"batteria_marca\" mancante.", 400)
  if (batteriaKwh == null || batteriaKwh <= 0) {
    return errore("Campo \"batteria_kwh\" mancante o non numerico.", 400)
  }
  if (!zona) return errore("Campo \"zona\" mancante.", 400)

  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[calculate-quote] Supabase admin client non configurato")
    return errore("Sorgente non configurata", 503)
  }

  const { data, error } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("nome, valido_dal, valido_al, fotovoltaico, accumuli, sconti, codici_sconto")
    .eq("stato", "pubblicato")
    .maybeSingle()

  if (error) {
    console.error("[calculate-quote]", error.message)
    return errore("Errore lettura listino", 500)
  }
  if (!data) {
    return errore("Nessun listino pubblicato al momento.", 503)
  }

  // Stesse normalizzazioni della scrittura: il jsonb puo' contenere versioni
  // piu' vecchie della struttura (es. codici senza cumulabile_con_sconto_zona).
  const catalogo: CatalogoPerCalcolo = {
    fotovoltaico: normalizeFotovoltaico(data.fotovoltaico),
    accumuli: normalizeAccumuli(data.accumuli),
    sconti: normalizeSconti(data.sconti),
    codici_sconto: normalizeCodiciSconto(data.codici_sconto),
  }

  try {
    const preventivo = calcolaPreventivo(catalogo, {
      kwp,
      batteria_marca: marca,
      batteria_kwh: batteriaKwh,
      zona,
      eps: body.eps === true,
      eps_gift: body.eps_gift === true,
      codice_sconto: codiceSconto,
    })

    return NextResponse.json(
      {
        ok: true,
        listino: {
          nome: data.nome,
          valido_dal: data.valido_dal,
          valido_al: data.valido_al,
        },
        configurazione: {
          kwp,
          batteria_marca: marca,
          batteria_kwh: batteriaKwh,
          zona,
          eps: body.eps === true,
          eps_gift: body.eps_gift === true,
        },
        preventivo,
      },
      { headers },
    )
  } catch (err) {
    // Input sintatticamente valido ma fuori listino: e' un 400 con l'elenco
    // dei valori ammessi, cosi' il configuratore puo' correggersi da solo.
    if (err instanceof ErrorePreventivo) {
      return errore(err.message, 400, {
        motivo: err.motivo,
        ...(err.disponibili.length > 0 ? { disponibili: err.disponibili } : {}),
      })
    }
    const message = err instanceof Error ? err.message : "Errore calcolo preventivo"
    console.error("[calculate-quote]", message)
    return errore("Errore calcolo preventivo", 500)
  }
}
