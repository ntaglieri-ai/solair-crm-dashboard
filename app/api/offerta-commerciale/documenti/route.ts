import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteFile } from "@/lib/nextcloud/admin-webdav"

export const runtime = "nodejs"

export async function DELETE(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response

  const path = new URL(request.url).searchParams.get("path")?.trim()
  if (!path) return NextResponse.json({ error: "Documento non valido" }, { status: 400 })
  if (!path.startsWith("Solair/Offerta-Commerciale/")) {
    return NextResponse.json({ error: "Documento fuori dal catalogo commerciale" }, { status: 400 })
  }

  const deleted = await deleteFile(path)
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error ?? `Eliminazione Nextcloud fallita (${deleted.status})` }, { status: 502 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })

  const { error: documentError } = await supabase.from("offerta_commerciale_documenti").delete().eq("path", path)
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })

  const { error: offerDeleteError } = await supabase
    .from("offerta_commerciale_offerte")
    .delete()
    .eq("pdf_path", path)
  if (offerDeleteError) return NextResponse.json({ error: offerDeleteError.message }, { status: 500 })

  const { error: coverUpdateError } = await supabase
    .from("offerta_commerciale_offerte")
    .update({ cover_path: null, aggiornato_at: new Date().toISOString() })
    .eq("cover_path", path)
  if (coverUpdateError) return NextResponse.json({ error: coverUpdateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
