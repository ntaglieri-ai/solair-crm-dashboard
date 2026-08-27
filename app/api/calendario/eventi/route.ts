import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiPage } from "@/lib/permissions/server"
import { getEventoById, queryEventi } from "@/lib/calendario/repository"
import {
  CORRELATO_COLONNA,
  isColoreValido,
  type EventoCorrelatoTipo,
} from "@/lib/calendario/types"

const CORRELATO_TIPI = Object.keys(CORRELATO_COLONNA) as EventoCorrelatoTipo[]

function parseCorrelato(searchParams: URLSearchParams) {
  const tipo = searchParams.get("correlatoTipo")
  const id = searchParams.get("correlatoId")
  if (!tipo || !id) return null
  if (!CORRELATO_TIPI.includes(tipo as EventoCorrelatoTipo)) return null
  return { tipo: tipo as EventoCorrelatoTipo, id }
}

export async function GET(request: Request) {
  // Lettura aperta a tutto lo staff che ha la pagina Calendario: la
  // policy di select su eventi_calendario e' using(true), quindi il gate
  // di pagina e' l'unico filtro — ed e' voluto, il calendario e'
  // condiviso.
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const eventi = await queryEventi({
    da: searchParams.get("da"),
    a: searchParams.get("a"),
    categoria: searchParams.get("categoria"),
    correlato: parseCorrelato(searchParams),
    creatoDa: searchParams.get("creatoDa"),
  })

  return NextResponse.json({ eventi })
}

type EventoPayload = {
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

export async function POST(request: Request) {
  const guard = await requireApiPage("calendario")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as EventoPayload | null
  const titolo = body?.titolo?.trim()
  const categoriaId = body?.categoria_id?.trim()
  const inizio = body?.inizio?.trim()

  if (!titolo || !categoriaId || !inizio) {
    return NextResponse.json(
      { error: "Payload non valido: 'titolo', 'categoria_id' e 'inizio' sono obbligatori" },
      { status: 400 },
    )
  }
  if (body?.colore != null && !isColoreValido(body.colore)) {
    return NextResponse.json(
      { error: "Colore non valido: atteso esadecimale a 6 cifre (es. #2e8b72)" },
      { status: 400 },
    )
  }
  if (body?.fine && new Date(body.fine) < new Date(inizio)) {
    return NextResponse.json(
      { error: "La fine dell'evento precede l'inizio" },
      { status: 400 },
    )
  }

  const autoreId = guard.permissions.snapshot.subject.userId
  // La policy di insert impone creato_da = current_utente_id(): senza id
  // utente il DB risponderebbe con un 42501 opaco.
  if (!autoreId) {
    return NextResponse.json(
      { error: "Utente non collegato a un'anagrafica: impossibile creare l'evento." },
      { status: 409 },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("eventi_calendario")
    .insert({
      titolo,
      categoria_id: categoriaId,
      colore: body?.colore ?? null,
      inizio,
      fine: body?.fine ?? null,
      note: body?.note?.trim() || null,
      cliente_id: body?.cliente_id ?? null,
      lead_id: body?.lead_id ?? null,
      installatore_id: body?.installatore_id ?? null,
      creato_da: autoreId,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Rilettura: l'insert non restituisce il nome dell'autore, che serve
  // al client per disegnare l'evento senza un secondo giro.
  const evento = await getEventoById(data.id)
  return NextResponse.json(evento ?? { id: data.id }, { status: 201 })
}
