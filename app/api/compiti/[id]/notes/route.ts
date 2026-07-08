import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("compiti", "view")
  if (guard.response) return guard.response
  const { id } = await params

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attivita")
    .select("id,tipo,testo,created_at,utente_id")
    .eq("record_tipo", "compito")
    .eq("record_id", id)
    .eq("tipo", "nota")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.utente_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
  const users = userIds.length
    ? await supabase.from("utenti").select("id,nome").in("id", userIds)
    : { data: [], error: null }
  const names = new Map((users.data ?? []).map((user) => [user.id, user.nome]))

  return NextResponse.json({
    notes: (data ?? []).map((row) => ({
      id: row.id,
      tipo: row.tipo,
      testo: row.testo,
      created_at: row.created_at,
      autore: row.utente_id
        ? names.get(row.utente_id) ?? "Utente CRM"
        : "Sistema",
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("compiti", "edit")
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
      record_tipo: "compito",
      utente_id: guard.permissions.snapshot.subject.userId,
    })
    .select("id,tipo,testo,created_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { ...data, autore: guard.permissions.snapshot.subject.nome },
    { status: 201 },
  )
}
