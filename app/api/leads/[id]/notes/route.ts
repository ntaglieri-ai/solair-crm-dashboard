import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { absoluteCrmUrl, notifyMentionedUsers, resolveNoteMentions } from "@/lib/notes/mentions-server"
import { parseNotePayload, uploadNoteFiles } from "@/lib/notes/note-files"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("lead", "edit")
  if (guard.response) return guard.response
  const { id } = await params
  if (!await canAccessOwnedRecord(guard.permissions.snapshot, "lead", "leads", "lead_proprietario_id", id)) return NextResponse.json({ error: "Lead non trovato" }, { status: 404 })
  const payload = await parseNotePayload(request)
  const text = payload?.text || (payload?.files.length ? "Allegato alla nota" : "")
  if (!text) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const supabase = await createClient()
  const { data: lead } = await supabase
    .from("leads")
    .select("nome_lead")
    .eq("id", id)
    .maybeSingle()
  const resolved = await resolveNoteMentions(supabase, text, payload?.mentions ?? [])
  const { data, error } = await supabase
    .from("attivita")
    .insert({
      tipo: "nota",
      testo: text,
      record_id: id,
      record_tipo: "lead",
      utente_id: guard.permissions.snapshot.subject.userId,
      menzioni: resolved.mentions,
      formato: "markdown",
    })
    .select("id,tipo,testo,created_at,menzioni,formato,allegati")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const uploaded = await uploadNoteFiles({
    recordTipo: "lead",
    recordId: id,
    nomeRecord: (lead?.nome_lead as string | null) ?? "",
    noteId: data.id,
    files: payload?.files ?? [],
  })
  if (uploaded.allegati.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from("attivita")
      .update({ allegati: uploaded.allegati })
      .eq("id", data.id)
      .select("id,tipo,testo,created_at,menzioni,formato,allegati")
      .single()
    if (!updateError && updated) data.allegati = updated.allegati
  }
  const notificationFailures = await notifyMentionedUsers({
    recipients: resolved.recipients,
    authorId: guard.permissions.snapshot.subject.userId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Un utente CRM",
    text,
    recordLabel: "un lead",
    recordUrl: absoluteCrmUrl(request, `/leads/${id}`),
  })
  return NextResponse.json({
    ...data,
    autore: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
    notificationFailures,
    attachmentFailures: uploaded.falliti,
  }, { status: 201 })
}
