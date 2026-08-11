import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeCodiciSconto } from "@/lib/offerta-commerciale/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_ALLOWED_ORIGINS = [
  "https://solairgroup.it",
  "https://www.solairgroup.it",
]

function allowedOrigins() {
  const configured = process.env.PUBLIC_DISCOUNT_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS
}

function corsHeaders(request: Request) {
  const headers: Record<string, string> = { Vary: "Origin" }
  const origin = request.headers.get("origin")?.replace(/\/$/, "")
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type"
    headers["Access-Control-Max-Age"] = "86400"
  }
  return headers
}

function normalizeCode(value: string) {
  return value.trim().slice(0, 40).toUpperCase().replace(/\s+/g, "-")
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: Request) {
  const headers = { ...corsHeaders(request), "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }
  const code = normalizeCode(new URL(request.url).searchParams.get("code") ?? "")

  if (code.length < 3) {
    return NextResponse.json({ valido: false }, { status: 400, headers })
  }

  const supabase = createAdminClient()
  if (!supabase) {
    console.error("[discount-code] Supabase admin client non configurato")
    return NextResponse.json({ valido: false }, { status: 503, headers })
  }

  const { data, error } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("codici_sconto")
    .eq("stato", "pubblicato")
    .maybeSingle()

  if (error) {
    console.error("[discount-code]", error.message)
    return NextResponse.json({ valido: false }, { status: 500, headers })
  }

  const codice = normalizeCodiciSconto(data?.codici_sconto).find(
    (item) => item.attivo && item.codice === code,
  )

  if (!codice) {
    return NextResponse.json({ valido: false }, { headers })
  }

  return NextResponse.json(
    {
      valido: true,
      codice: codice.codice,
      sconto_percentuale: codice.tipo === "percentuale" ? (codice.valore ?? 0) : 0,
      tipo: codice.tipo,
      nome: codice.nome,
      descrizione: codice.descrizione,
    },
    { headers },
  )
}
