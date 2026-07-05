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
  const body = (await request.json().catch(() => null)) as {
    title?: string
    dueDate?: string
    priority?: string
    ownerId?: string
    sede?: string
  } | null
  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: "Oggetto obbligatorio" }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("compiti")
    .insert({
      oggetto: title,
      stato: "Non iniziato",
      priorita: body?.priority || "Medio",
      scadenza: body?.dueDate || null,
      proprietario_id: body?.ownerId || null,
      sede: body?.sede || null,
      correlato_id: id,
      correlato_tipo: "lead",
    })
    .select("id,oggetto,stato,priorita,scadenza")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
