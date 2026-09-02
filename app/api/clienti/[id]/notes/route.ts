import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { absoluteCrmUrl, notifyMentionedUsers, resolveNoteMentions } from "@/lib/notes/mentions-server"
import type { NoteMentionDraft } from "@/lib/notes/mentions"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "view")
  if (guard.response) return guard.response
  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "clienti", "clienti", "clienti_proprietario_id", id)) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("attivita")
    .select("id,testo,created_at,utente_id,menzioni")
    .eq("record_tipo", "cliente")
    .eq("record_id", id)
    .eq("tipo", "nota")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ids = [...new Set((data ?? []).map((row) => row.utente_id).filter((value): value is string => Boolean(value)))]
  const users = ids.length ? await supabase.from("utenti").select("id,nome").in("id", ids) : { data: [] }
  const names = new Map((users.data ?? []).map((user) => [user.id, user.nome]))
  return NextResponse.json({ notes: (data ?? []).map((row) => ({
    id: row.id,
    testo: row.testo ?? "",
    created_at: row.created_at,
    autore: row.utente_id ? names.get(row.utente_id) ?? "Utente CRM" : "Sistema",
    menzioni: row.menzioni ?? [],
  })) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "edit")
  if (guard.response) return guard.response
  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "clienti", "clienti", "clienti_proprietario_id", id)) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  const body = (await request.json().catch(() => null)) as { text?: string; mentions?: NoteMentionDraft[] } | null
  const text = body?.text?.trim()
  if (!text) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const supabase = await createClient()
  const resolved = await resolveNoteMentions(supabase, text, Array.isArray(body?.mentions) ? body.mentions : [])
  const { data, error } = await supabase
    .from("attivita")
    .insert({
      tipo: "nota",
      testo: text,
      record_id: id,
      record_tipo: "cliente",
      utente_id: guard.permissions.snapshot.subject.userId,
      menzioni: resolved.mentions,
    })
    .select("id,tipo,testo,created_at,menzioni")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const notificationFailures = await notifyMentionedUsers({
    recipients: resolved.recipients,
    authorId: guard.permissions.snapshot.subject.userId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Un utente CRM",
    text,
    recordLabel: "un cliente",
    recordUrl: absoluteCrmUrl(request, `/clienti/${id}`),
  })
  return NextResponse.json({
    ...data,
    autore: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
    notificationFailures,
  }, { status: 201 })
}
