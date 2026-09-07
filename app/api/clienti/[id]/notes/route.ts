import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { canAccessOwnedRecord } from "@/lib/permissions/data-scope"
import { absoluteCrmUrl, notifyMentionedUsers, resolveNoteMentions } from "@/lib/notes/mentions-server"
import { parseNotePayload, uploadNoteFiles } from "@/lib/notes/note-files"

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
    .select("id,testo,created_at,utente_id,menzioni,formato,allegati")
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
    formato: row.formato ?? "plain",
    allegati: row.allegati ?? [],
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
  const payload = await parseNotePayload(request)
  const text = payload?.text || (payload?.files.length ? "Allegato alla nota" : "")
  if (!text) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const supabase = await createClient()
  const { data: cliente } = await supabase
    .from("clienti")
    .select("nome_clienti,nome,cognome")
    .eq("id", id)
    .maybeSingle()
  const nomeRecord =
    (cliente?.nome_clienti as string | null) ||
    [cliente?.nome, cliente?.cognome].filter(Boolean).join(" ") ||
    ""
  const resolved = await resolveNoteMentions(supabase, text, payload?.mentions ?? [])
  const { data, error } = await supabase
    .from("attivita")
    .insert({
      tipo: "nota",
      testo: text,
      record_id: id,
      record_tipo: "cliente",
      utente_id: guard.permissions.snapshot.subject.userId,
      menzioni: resolved.mentions,
      formato: "markdown",
    })
    .select("id,tipo,testo,created_at,menzioni,formato,allegati")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const uploaded = await uploadNoteFiles({
    recordTipo: "cliente",
    recordId: id,
    nomeRecord,
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
    recordLabel: "un cliente",
    recordUrl: absoluteCrmUrl(request, `/clienti/${id}`),
  })
  return NextResponse.json({
    ...data,
    autore: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
    notificationFailures,
    attachmentFailures: uploaded.falliti,
  }, { status: 201 })
}
