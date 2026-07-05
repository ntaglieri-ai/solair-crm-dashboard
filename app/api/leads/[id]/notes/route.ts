import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "edit")
  if (guard.response) return guard.response
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { text?: string } | null
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attivita")
    .insert({
      tipo: "nota",
      testo: text,
      record_id: id,
      record_tipo: "lead",
      utente_id: guard.permissions.snapshot.subject.userId,
    })
    .select("id,tipo,testo,created_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
