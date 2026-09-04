import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"
import { notaInternaInput } from "@/lib/clienti/note-interne-input"
import { resolveInternalMentions, notifyInternalMentions } from "@/lib/clienti/note-interne-mentions-server"
import type { NoteMention } from "@/lib/notes/mentions"

type Params = { params: Promise<{ id: string; notaId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { id, notaId } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response

  const parsed = notaInternaInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Nota vuota o menzioni non valide" }, { status: 400 })
  const { contenuto } = parsed.data

  const supabase = await createClient()
  const { data: previous, error: readError } = await supabase.from("cliente_note_interne")
    .select("contenuto,menzioni,modificato_il").eq("id", notaId).eq("cliente_id", id).eq("eliminato", false).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!previous) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 })
  // Client precedenti senza metadati non devono cancellare menzioni in silenzio.
  if (parsed.data.menzioni === undefined && previous.menzioni?.length && contenuto !== previous.contenuto) {
    return NextResponse.json({ error: "Ricarica la pagina per modificare una nota con menzioni" }, { status: 409 })
  }
  let menzioni: NoteMention[]
  try {
    menzioni = parsed.data.menzioni === undefined ? (previous.menzioni ?? [])
      : await resolveInternalMentions(id, contenuto, parsed.data.menzioni)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verifica menzioni non riuscita" }, { status: 400 })
  }
  const modificatoIl = new Date().toISOString()
  let update = supabase.from("cliente_note_interne").update({
    contenuto, menzioni,
    modificato_da: guard.permissions.snapshot.subject.userId,
    modificato_il: modificatoIl,
  }).eq("id", notaId).eq("cliente_id", id).eq("eliminato", false)
  // Due modifiche concorrenti non devono produrre doppie notifiche/perdita dati.
  update = previous.modificato_il ? update.eq("modificato_il", previous.modificato_il) : update.is("modificato_il", null)
  const { data, error } = await update.select("id").maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Una UPDATE negata dalla RLS torna 0 righe senza errore (vedi
  // permessi_ruoli_write_policies): senza questo controllo la chiamata
  // risponderebbe 200 su una nota mai toccata.
  if (!data) return NextResponse.json({ error: "Nota modificata o non più disponibile. Ricarica le note prima di riprovare." }, { status: 409 })

  const notificationFailures = await notifyInternalMentions({
    request, clienteId: id, mentions: menzioni, previous: previous.menzioni ?? [],
    authorId: guard.permissions.snapshot.subject.userId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
  })
  return NextResponse.json({ ok: true, contenuto, menzioni, modificato_il: modificatoIl, notificationFailures })
}

/** Soft delete: la riga resta, con `eliminato` e `eliminato_il` valorizzati. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id, notaId } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cliente_note_interne")
    .update({ eliminato: true, eliminato_il: new Date().toISOString() })
    .eq("id", notaId)
    .eq("cliente_id", id)
    .eq("eliminato", false)
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
