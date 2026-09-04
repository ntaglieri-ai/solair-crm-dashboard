import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"
import type { NotaInterna } from "@/lib/clienti/note-interne"
import { notaInternaInput } from "@/lib/clienti/note-interne-input"
import { resolveInternalMentions, notifyInternalMentions } from "@/lib/clienti/note-interne-mentions-server"

const COLUMNS =
  "id,contenuto,menzioni,creato_da,creato_il,modificato_da,modificato_il"

type NotaRow = Omit<NotaInterna, "creato_da_nome" | "modificato_da_nome">

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

  const parsed = notaInternaInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Nota vuota o menzioni non valide" }, { status: 400 })
  const { contenuto } = parsed.data

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
    .insert({ cliente_id: id, contenuto, menzioni, creato_da: autoreId })
    .select(COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = [data as NotaRow]
  const [nota] = withAutori(rows, await autoriNomi(supabase, rows))
  const notificationFailures = await notifyInternalMentions({
    text: contenuto, clienteId: id, mentions: menzioni, authorId: autoreId,
    authorName: guard.permissions.snapshot.subject.nome ?? "Utente CRM",
  })
  return NextResponse.json({ ...nota, notificationFailures }, { status: 201 })
}
