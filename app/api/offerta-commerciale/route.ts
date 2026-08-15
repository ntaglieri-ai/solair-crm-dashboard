import { NextResponse } from "next/server"
import { requireApiAction, requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteFile } from "@/lib/nextcloud/webdav"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"
import {
  loadOffertaCommerciale,
  normalizeAccessori,
  normalizeAccumuli,
  normalizeCodiciSconto,
  normalizeFotovoltaico,
  normalizeSconti,
  normalizeSpecificheProdotto,
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
      versioni: data.cataloghi.map(({
        id,
        nome,
        stato,
        valido_dal,
        valido_al,
        fonte_path,
        fonte_fingerprint,
        pubblicato_at,
        aggiornato_at,
      }) => ({
        id,
        nome,
        stato,
        valido_dal,
        valido_al,
        fonte_path,
        fonte_fingerprint,
        pubblicato_at,
        aggiornato_at,
      })),
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
  const { data: catalogo, error: readError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("id, stato")
    .eq("id", body.id)
    .maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!catalogo) return NextResponse.json({ error: "Listino non trovato" }, { status: 404 })
  if (catalogo.stato === "pubblicato") return NextResponse.json({ ok: true })
  if (catalogo.stato !== "bozza" && catalogo.stato !== "archiviato") {
    return NextResponse.json({ error: "Stato listino non pubblicabile" }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { error: archiveError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .update({ stato: "archiviato", aggiornato_at: now })
    .eq("stato", "pubblicato")
    .neq("id", body.id)
  if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 })

  const { error: publishError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .update({ stato: "pubblicato", pubblicato_at: now, aggiornato_at: now })
    .eq("id", body.id)
  if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 })
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
  // Le specifiche prodotto si fondono su quelle salvate: il client rimanda solo
  // cio' che conosce e le altre chiavi del JSON non devono andare perse.
  const { data: corrente, error: correnteError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("specifiche_prodotto")
    .eq("id", catalogo.id)
    .maybeSingle()
  if (correnteError) return NextResponse.json({ error: correnteError.message }, { status: 500 })
  const now = new Date().toISOString()
  const { error } = await supabase.from("offerta_commerciale_cataloghi").update({
    nome: typeof catalogo.nome === "string" ? catalogo.nome.trim().slice(0, 180) : "Listino commerciale",
    valido_dal: typeof catalogo.valido_dal === "string" && catalogo.valido_dal ? catalogo.valido_dal : null,
    valido_al: typeof catalogo.valido_al === "string" && catalogo.valido_al ? catalogo.valido_al : null,
    fotovoltaico: normalizeFotovoltaico(catalogo.fotovoltaico),
    accumuli: normalizeAccumuli(catalogo.accumuli),
    accessori: normalizeAccessori(catalogo.accessori),
    sconti: normalizeSconti(catalogo.sconti),
    codici_sconto: normalizeCodiciSconto(catalogo.codici_sconto),
    specifiche_prodotto: normalizeSpecificheProdotto(catalogo.specifiche_prodotto, corrente?.specifiche_prodotto),
    note: typeof catalogo.note === "string" ? catalogo.note.trim().slice(0, 4000) || null : null,
    aggiornato_at: now,
  }).eq("id", catalogo.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, aggiornato_at: now })
}

export async function DELETE(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Listino non valido" }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })

  const { data: catalogo, error: catalogError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("id, nome, stato, fonte_path")
    .eq("id", id)
    .maybeSingle()
  if (catalogError) return NextResponse.json({ error: catalogError.message }, { status: 500 })
  if (!catalogo) return NextResponse.json({ error: "Listino non trovato" }, { status: 404 })
  if (catalogo.stato !== "archiviato") {
    return NextResponse.json({ error: "È possibile eliminare soltanto un listino archiviato" }, { status: 409 })
  }

  let sourceDeleted = false
  if (catalogo.fonte_path) {
    const { count, error: countError } = await supabase
      .from("offerta_commerciale_cataloghi")
      .select("id", { count: "exact", head: true })
      .eq("fonte_path", catalogo.fonte_path)
      .neq("id", catalogo.id)
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
    if ((count ?? 0) === 0) {
      try {
        const nextcloud = await commercialNextcloudUser(guard.permissions.snapshot.subject)
        await deleteFile(nextcloud.username, nextcloud.appPassword, catalogo.fonte_path)
        sourceDeleted = true
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Eliminazione Nextcloud fallita" }, { status: 502 })
      }
    }
  }

  const { error: deleteError } = await supabase.from("offerta_commerciale_cataloghi").delete().eq("id", id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (sourceDeleted && catalogo.fonte_path) {
    await supabase.from("offerta_commerciale_documenti").delete().eq("path", catalogo.fonte_path)
  }
  return NextResponse.json({ ok: true, sourceDeleted })
}
