import { NextResponse } from "next/server"
import { requireApiAction, requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  loadOffertaCommerciale,
  normalizeAccessori,
  normalizeAccumuli,
  normalizeFotovoltaico,
  normalizeSconti,
  OFFERTA_COMMERCIALE_ROOT,
} from "@/lib/offerta-commerciale/store"

export async function GET() {
  const guard = await requireApiPage("offerta_commerciale")
  if (guard.response) return guard.response
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  try {
    const data = await loadOffertaCommerciale(supabase)
    const canManage = guard.permissions.canAction("offerta_commerciale.manage")
    const catalogo = data.cataloghi.find((item) => item.stato === "pubblicato")
      ?? (canManage ? data.cataloghi.find((item) => item.stato === "bozza") : null)
      ?? data.cataloghi[0]
      ?? null
    return NextResponse.json({
      offerte: data.offerte,
      documenti: data.documenti,
      catalogo,
      versioni: data.cataloghi.map(({ id, nome, stato, valido_dal, valido_al, aggiornato_at }) => ({ id, nome, stato, valido_dal, valido_al, aggiornato_at })),
      canManage,
      nextcloudRoot: OFFERTA_COMMERCIALE_ROOT,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore lettura offerta commerciale"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const body = await request.json().catch(() => null) as { id?: string; action?: string } | null
  if (!body?.id || body.action !== "publish") return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  const { error } = await supabase.rpc("pubblica_catalogo_offerta_commerciale", { p_id: body.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const catalogo = body?.catalogo as Record<string, unknown> | undefined
  if (!catalogo || typeof catalogo.id !== "string") {
    return NextResponse.json({ error: "Catalogo non valido" }, { status: 400 })
  }
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })
  const now = new Date().toISOString()
  const { error } = await supabase.from("offerta_commerciale_cataloghi").update({
    nome: typeof catalogo.nome === "string" ? catalogo.nome.trim().slice(0, 180) : "Listino commerciale",
    valido_dal: typeof catalogo.valido_dal === "string" && catalogo.valido_dal ? catalogo.valido_dal : null,
    valido_al: typeof catalogo.valido_al === "string" && catalogo.valido_al ? catalogo.valido_al : null,
    fotovoltaico: normalizeFotovoltaico(catalogo.fotovoltaico),
    accumuli: normalizeAccumuli(catalogo.accumuli),
    accessori: normalizeAccessori(catalogo.accessori),
    sconti: normalizeSconti(catalogo.sconti),
    note: typeof catalogo.note === "string" ? catalogo.note.trim().slice(0, 4000) || null : null,
    aggiornato_at: now,
  }).eq("id", catalogo.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, aggiornato_at: now })
}
