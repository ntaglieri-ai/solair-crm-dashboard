import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { commercialNextcloudUser } from "@/lib/offerta-commerciale/nextcloud-user"
import { ensurePublicFileShare } from "@/lib/nextcloud/public-share"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response
  const { id } = await context.params

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })

  const { data: offerta, error } = await supabase
    .from("offerta_commerciale_offerte")
    .select("id, pdf_path")
    .eq("id", id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!offerta) return NextResponse.json({ error: "Offerta non trovata" }, { status: 404 })
  if (!offerta.pdf_path) return NextResponse.json({ error: "PDF offerta non disponibile" }, { status: 400 })

  try {
    const nextcloud = await commercialNextcloudUser(guard.permissions.snapshot.subject)
    const url = await ensurePublicFileShare(nextcloud.username, nextcloud.appPassword, offerta.pdf_path)
    const { error: updateError } = await supabase
      .from("offerta_commerciale_offerte")
      .update({ url_pubblico: url, aggiornato_at: new Date().toISOString() })
      .eq("id", id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ url_pubblico: url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generazione link pubblico non riuscita" },
      { status: 502 },
    )
  }
}
