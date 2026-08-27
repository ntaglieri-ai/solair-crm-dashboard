import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import { getEventoById } from "@/lib/calendario/repository"
import { isColoreValido } from "@/lib/calendario/types"

type Params = { params: Promise<{ id: string }> }

type EventoPatch = {
  titolo?: string
  categoria_id?: string
  colore?: string | null
  inizio?: string
  fine?: string | null
  note?: string | null
  cliente_id?: string | null
  lead_id?: string | null
  installatore_id?: string | null
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response
  const { id } = await params

  const body = (await request.json().catch(() => null)) as EventoPatch | null
  if (!body) return NextResponse.json({ error: "Payload non valido" }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.titolo !== undefined) {
    const titolo = body.titolo.trim()
    if (!titolo) return NextResponse.json({ error: "Titolo vuoto" }, { status: 400 })
    patch.titolo = titolo
  }
  if (body.categoria_id !== undefined) {
    const categoriaId = body.categoria_id.trim()
    if (!categoriaId) return NextResponse.json({ error: "Categoria mancante" }, { status: 400 })
    patch.categoria_id = categoriaId
  }
  if (body.colore !== undefined) {
    // null e' legittimo e significa "torna a ereditare dalla categoria".
    if (body.colore !== null && !isColoreValido(body.colore)) {
      return NextResponse.json(
        { error: "Colore non valido: atteso esadecimale a 6 cifre (es. #2e8b72)" },
        { status: 400 },
      )
    }
    patch.colore = body.colore
  }
  if (body.inizio !== undefined) patch.inizio = body.inizio
  if (body.fine !== undefined) patch.fine = body.fine
  if (body.note !== undefined) patch.note = body.note?.trim() || null
  if (body.cliente_id !== undefined) patch.cliente_id = body.cliente_id
  if (body.lead_id !== undefined) patch.lead_id = body.lead_id
  if (body.installatore_id !== undefined) patch.installatore_id = body.installatore_id

  // L'intervallo va validato sui valori risultanti, non solo su quelli in
  // arrivo: una PATCH che sposta il solo `inizio` oltre la `fine` gia' a
  // DB sarebbe respinta dal CHECK con un messaggio incomprensibile.
  const attuale = await getEventoById(id)
  if (!attuale) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
  const inizioFinale = (patch.inizio as string) ?? attuale.inizio
  const fineFinale = (body.fine !== undefined ? body.fine : attuale.fine) ?? null
  if (fineFinale && new Date(fineFinale) < new Date(inizioFinale)) {
    return NextResponse.json({ error: "La fine dell'evento precede l'inizio" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("eventi_calendario")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Una UPDATE respinta dalla RLS torna 0 righe senza errore: qui vuol
  // dire che l'evento e' di un altro e chi scrive non e' Direttore o piu'.
  if (!data) {
    return NextResponse.json(
      { error: "Puoi modificare solo gli eventi che hai creato." },
      { status: 403 },
    )
  }

  return NextResponse.json(await getEventoById(id))
}

export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response
  const { id } = await params

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("eventi_calendario")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json(
      { error: "Puoi eliminare solo gli eventi che hai creato." },
      { status: 403 },
    )
  }

  return NextResponse.json({ ok: true })
}
