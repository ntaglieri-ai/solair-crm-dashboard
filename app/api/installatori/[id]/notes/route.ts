import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { absoluteCrmUrl, notifyMentionedUsers, resolveNoteMentions } from "@/lib/notes/mentions-server"
import type { NoteMentionDraft } from "@/lib/notes/mentions"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("installatori", "edit")
  if (guard.response) return guard.response
  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "installatori", "installatori", "proprietario_id", id)) return NextResponse.json({ error: "Installatore non trovato" }, { status: 404 })
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
      record_tipo: "installatore",
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
    recordLabel: "un installatore",
    recordUrl: absoluteCrmUrl(request, `/installatori/${id}`),
  })
  return NextResponse.json({ ...data, notificationFailures }, { status: 201 })
}
