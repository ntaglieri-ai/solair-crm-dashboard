import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"
import { notaInternaInput } from "@/lib/clienti/note-interne-input"
import { resolveInternalMentions, notifyInternalMentions } from "@/lib/clienti/note-interne-mentions-server"
import { uploadNoteFiles } from "@/lib/notes/note-files"
import type { NoteAttachment, NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"

type Params = { params: Promise<{ id: string; notaId: string }> }
type NotaInternaPayload = { contenuto: string; menzioni?: NoteMentionDraft[]; files: File[] }

function safeMentions(value: unknown): NoteMentionDraft[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (
          !item ||
          typeof item.userId !== "string" ||
          typeof item.start !== "number" ||
          typeof item.end !== "number"
        ) {
          return []
        }
        return [{ userId: item.userId, start: item.start, end: item.end }]
      })
    : []
}

async function parseNotaInternaPayload(request: Request): Promise<NotaInternaPayload | null> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null)
    if (!formData) return null
    const rawMentions = formData.get("menzioni") ?? formData.get("mentions")
    let mentions: unknown
    if (typeof rawMentions === "string" && rawMentions.trim()) {
      try {
        mentions = JSON.parse(rawMentions)
      } catch {
        mentions = []
      }
    }
    const contenuto = formData.get("contenuto") ?? formData.get("text")
    return {
      contenuto: typeof contenuto === "string" ? contenuto : "",
      menzioni: safeMentions(mentions),
      files: formData.getAll("files").filter((item): item is File => item instanceof File),
    }
  }

  const body = (await request.json().catch(() => null)) as
    | { contenuto?: unknown; text?: unknown; menzioni?: unknown; mentions?: unknown }
    | null
  const contenuto = typeof body?.contenuto === "string"
    ? body.contenuto
    : typeof body?.text === "string"
      ? body.text
      : ""
  const rawMentions = body && ("menzioni" in body || "mentions" in body)
    ? body.menzioni ?? body.mentions
    : undefined
  return {
    contenuto,
    menzioni: rawMentions === undefined ? undefined : safeMentions(rawMentions),
    files: [],
  }
}

async function clienteNomeRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clienteId: string,
) {
  const { data } = await supabase
    .from("clienti")
    .select("nome_clienti,nome,cognome")
    .eq("id", clienteId)
    .maybeSingle()
  return (
    (data?.nome_clienti as string | null) ||
    [data?.nome, data?.cognome].filter(Boolean).join(" ") ||
    "Cliente"
  )
}

export async function PATCH(request: Request, { params }: Params) {
  const { id, notaId } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response

  const payload = await parseNotaInternaPayload(request)
  const parsed = notaInternaInput.safeParse({ contenuto: payload?.contenuto, menzioni: payload?.menzioni })
  if (!parsed.success) return NextResponse.json({ error: "Nota vuota o menzioni non valide" }, { status: 400 })
  const { contenuto } = parsed.data

  const supabase = await createClient()
  const { data: previous, error: readError } = await supabase.from("cliente_note_interne")
    .select("contenuto,menzioni,allegati,modificato_il").eq("id", notaId).eq("cliente_id", id).eq("eliminato", false).maybeSingle()
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
    text: contenuto, clienteId: id, mentions: menzioni, previous: previous.menzioni ?? [],
    authorId: guard.permissions.snapshot.subject.userId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
  })
  const currentAllegati = (previous.allegati ?? []) as NoteAttachment[]
  const uploaded = await uploadNoteFiles({
    recordTipo: "cliente",
    recordId: id,
    nomeRecord: payload?.files.length ? await clienteNomeRecord(supabase, id) : "Cliente",
    noteId: notaId,
    files: payload?.files ?? [],
  })
  const allegati = uploaded.allegati.length > 0 ? [...currentAllegati, ...uploaded.allegati] : currentAllegati
  if (uploaded.allegati.length > 0) {
    await supabase
      .from("cliente_note_interne")
      .update({ allegati })
      .eq("id", notaId)
      .eq("cliente_id", id)
      .eq("eliminato", false)
  }
  return NextResponse.json({
    ok: true,
    contenuto,
    menzioni,
    allegati,
    modificato_il: modificatoIl,
    notificationFailures,
    attachmentFailures: uploaded.falliti,
  })
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
