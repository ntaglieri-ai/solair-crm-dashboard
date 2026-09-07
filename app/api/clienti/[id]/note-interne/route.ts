import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"
import type { NotaInterna } from "@/lib/clienti/note-interne"
import { notaInternaInput } from "@/lib/clienti/note-interne-input"
import { resolveInternalMentions, notifyInternalMentions } from "@/lib/clienti/note-interne-mentions-server"
import { uploadNoteFiles } from "@/lib/notes/note-files"
import type { NoteMentionDraft } from "@/lib/notes/mentions"

const COLUMNS =
  "id,contenuto,formato,menzioni,allegati,creato_da,creato_il,modificato_da,modificato_il"

type NotaRow = Omit<NotaInterna, "creato_da_nome" | "modificato_da_nome">
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

/**
 * Le note portano solo gli id degli autori: il nome va risolto a parte.
 * Una join PostgREST su `utenti` non e' praticabile — la tabella non ha
 * FK dichiarata verso utenti in entrambe le direzioni e il resto del
 * progetto risolve i proprietari cosi' (vedi lib/scadenze/repository).
 */
async function autoriNomi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: NotaRow[],
) {
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [row.creato_da, row.modificato_da])
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (ids.length === 0) return new Map<string, string>()

  const { data } = await supabase.from("utenti").select("id,nome").in("id", ids)
  return new Map((data ?? []).map((user) => [user.id as string, user.nome as string]))
}

function withAutori(rows: NotaRow[], nomi: Map<string, string>): NotaInterna[] {
  return rows.map((row) => ({
    ...row,
    creato_da_nome: row.creato_da ? (nomi.get(row.creato_da) ?? null) : null,
    modificato_da_nome: row.modificato_da ? (nomi.get(row.modificato_da) ?? null) : null,
  }))
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cliente_note_interne")
    .select(COLUMNS)
    .eq("cliente_id", id)
    .eq("eliminato", false)
    .order("creato_il", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as NotaRow[]
  return NextResponse.json({ note: withAutori(rows, await autoriNomi(supabase, rows)) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = await requireApiNoteInterne(id)
  if (guard.response) return guard.response

  const payload = await parseNotaInternaPayload(request)
  const contenuto = payload?.contenuto || (payload?.files.length ? "Allegato alla nota interna" : "")
  const parsed = notaInternaInput.safeParse({ contenuto, menzioni: payload?.menzioni })
  if (!parsed.success) return NextResponse.json({ error: "Nota vuota o menzioni non valide" }, { status: 400 })

  const autoreId = guard.permissions.snapshot.subject.userId
  // La policy di insert impone creato_da = current_utente_id(): senza id
  // utente l'insert verrebbe respinto dalla RLS con un 42501 opaco.
  // Meglio dirlo qui.
  if (!autoreId) {
    return NextResponse.json(
      { error: "Utente non collegato a un'anagrafica: impossibile firmare la nota." },
      { status: 409 },
    )
  }

  let menzioni
  try {
    menzioni = await resolveInternalMentions(id, contenuto, parsed.data.menzioni ?? [])
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verifica menzioni non riuscita" }, { status: 400 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cliente_note_interne")
    .insert({ cliente_id: id, contenuto, formato: "markdown", menzioni, creato_da: autoreId })
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const uploaded = await uploadNoteFiles({
    recordTipo: "cliente",
    recordId: id,
    nomeRecord: payload?.files.length ? await clienteNomeRecord(supabase, id) : "Cliente",
    noteId: data.id,
    files: payload?.files ?? [],
  })
  if (uploaded.allegati.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from("cliente_note_interne")
      .update({ allegati: uploaded.allegati })
      .eq("id", data.id)
      .select(COLUMNS)
      .single()
    if (!updateError && updated) data.allegati = updated.allegati
  }

  const rows = [data as NotaRow]
  const [nota] = withAutori(rows, await autoriNomi(supabase, rows))
  const notificationFailures = await notifyInternalMentions({
    text: contenuto, clienteId: id, mentions: menzioni, authorId: autoreId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
  })
  return NextResponse.json({ ...nota, notificationFailures }, { status: 201 })
}
