import { NextResponse } from "next/server"
import { getScadenzaById, createScadenzaRecord } from "@/lib/scadenze/repository"
import { requireApiRecord } from "@/lib/permissions/server"

// Clona reale di una scadenza — stesso pattern di app/api/clienti/[id]/duplica.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("scadenze", "create")
  if (guard.response) return guard.response

  const { id } = await params
  const source = await getScadenzaById(id)
  if (!source) {
    return NextResponse.json({ error: "Scadenza non trovata" }, { status: 404 })
  }

  const cloned = await createScadenzaRecord({
    nome: `${source.nome} (copia)`,
    data_scadenza: source.data_scadenza,
    proprietario_id: source.proprietario_id,
    descrizione: source.descrizione,
    connesso_a_id: source.connesso_a_id,
    connesso_a_tipo: source.connesso_a_tipo,
    tag: source.tag,
  })

  return NextResponse.json(cloned, { status: 201 })
}
