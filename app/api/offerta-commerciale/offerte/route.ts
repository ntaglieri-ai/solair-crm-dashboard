import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"

const TIPI_OFFERTA = new Set(["offerta", "locandina", "brochure", "finanziaria", "pagina"])

function normalizeTipo(value: unknown) {
  return typeof value === "string" && TIPI_OFFERTA.has(value) ? value : "offerta"
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!["http:", "https:"].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const titolo = typeof body?.titolo === "string" ? body.titolo.trim().slice(0, 180) : ""
  if (!titolo) return NextResponse.json({ error: "Titolo obbligatorio" }, { status: 400 })

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  const { data, error } = await supabase.from("offerta_commerciale_offerte").insert({
    titolo,
    descrizione: typeof body?.descrizione === "string" ? body.descrizione.trim().slice(0, 2000) || null : null,
    tipo: normalizeTipo(body?.tipo),
    url_pubblico: normalizeUrl(body?.url_pubblico),
    valido_dal: typeof body?.valido_dal === "string" && body.valido_dal ? body.valido_dal : null,
    valido_al: typeof body?.valido_al === "string" && body.valido_al ? body.valido_al : null,
    pubblicata: body?.pubblicata === true,
    ordinamento: Number.isFinite(Number(body?.ordinamento)) ? Number(body?.ordinamento) : 0,
    configurazioni: Array.isArray(body?.configurazioni) ? body.configurazioni.slice(0, 30) : [],
    aggiornato_at: new Date().toISOString(),
  }).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ offerta: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Offerta non valida" }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  const { error } = await supabase.from("offerta_commerciale_offerte").update({
    titolo: typeof body.titolo === "string" ? body.titolo.trim().slice(0, 180) : undefined,
    descrizione: typeof body.descrizione === "string" ? body.descrizione.trim().slice(0, 2000) || null : null,
    tipo: normalizeTipo(body.tipo),
    url_pubblico: normalizeUrl(body.url_pubblico),
    valido_dal: typeof body.valido_dal === "string" && body.valido_dal ? body.valido_dal : null,
    valido_al: typeof body.valido_al === "string" && body.valido_al ? body.valido_al : null,
    pubblicata: body.pubblicata === true,
    ordinamento: Number.isFinite(Number(body.ordinamento)) ? Number(body.ordinamento) : 0,
    configurazioni: Array.isArray(body.configurazioni) ? body.configurazioni.slice(0, 30) : [],
    aggiornato_at: new Date().toISOString(),
  }).eq("id", body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
