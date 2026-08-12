import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  normalizeAccessori,
  normalizeAccumuli,
  normalizeFotovoltaico,
} from "@/lib/offerta-commerciale/store"
import { corsHeaders } from "@/lib/public/cors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIPI_VALIDI = new Set(["pannelli", "accumuli", "fotovoltaico", "accessori"])

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: Request) {
  const headers = {
    ...corsHeaders(request),
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  }

  const tipo = new URL(request.url).searchParams.get("tipo") ?? ""
  if (!TIPI_VALIDI.has(tipo)) {
    return NextResponse.json(
      { error: "Parametro 'tipo' mancante o non valido. Valori ammessi: pannelli, accumuli, fotovoltaico, accessori" },
      { status: 400, headers },
    )
  }

  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[catalogo] Supabase admin client non configurato")
    return NextResponse.json({ error: "Servizio non disponibile" }, { status: 503, headers })
  }

  const { data, error } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("fotovoltaico, accumuli, accessori, specifiche_prodotto, aggiornato_at")
    .eq("stato", "pubblicato")
    .order("aggiornato_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[catalogo]", error.message)
    return NextResponse.json({ error: "Errore lettura catalogo" }, { status: 500, headers })
  }

  if (!data) {
    return NextResponse.json({ error: "Nessun listino pubblicato" }, { status: 404, headers })
  }

  const specifiche = (data.specifiche_prodotto ?? {}) as { pannelli?: unknown[] }

  if (tipo === "pannelli") {
    const pannelli = Array.isArray(specifiche.pannelli)
      ? specifiche.pannelli.filter((p) => (p as { attivo?: boolean })?.attivo !== false)
      : []
    return NextResponse.json({ pannelli, aggiornato_at: data.aggiornato_at }, { headers })
  }

  if (tipo === "accumuli") {
    return NextResponse.json(
      { accumuli: normalizeAccumuli(data.accumuli), aggiornato_at: data.aggiornato_at },
      { headers },
    )
  }

  if (tipo === "fotovoltaico") {
    return NextResponse.json(
      { fotovoltaico: normalizeFotovoltaico(data.fotovoltaico), aggiornato_at: data.aggiornato_at },
      { headers },
    )
  }

  return NextResponse.json(
    { accessori: normalizeAccessori(data.accessori), aggiornato_at: data.aggiornato_at },
    { headers },
  )
}
