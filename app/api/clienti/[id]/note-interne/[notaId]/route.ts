import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiNoteInterne } from "@/lib/clienti/note-interne-guard"

type Params = { params: Promise<{ id: string; notaId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireApiNoteInterne()
  if (guard.response) return guard.response
  const { id, notaId } = await params

  const body = (await request.json().catch(() => null)) as { contenuto?: string } | null
  const contenuto = body?.contenuto?.trim()
  if (!contenuto) return NextResponse.json({ error: "Nota vuota" }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("cliente_note_interne")
    .update({
      contenuto,
      modificato_da: guard.permissions.snapshot.subject.userId,
      modificato_il: new Date().toISOString(),
    })
    .eq("id", notaId)
    .eq("cliente_id", id)
    .eq("eliminato", false)
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Una UPDATE negata dalla RLS torna 0 righe senza errore (vedi
  // permessi_ruoli_write_policies): senza questo controllo la chiamata
  // risponderebbe 200 su una nota mai toccata.
  if (!data) return NextResponse.json({ error: "Nota non trovata" }, { status: 404 })

  return NextResponse.json({ ok: true })
}

/** Soft delete: la riga resta, con `eliminato` e `eliminato_il` valorizzati. */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireApiNoteInterne()
  if (guard.response) return guard.response
  const { id, notaId } = await params

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
