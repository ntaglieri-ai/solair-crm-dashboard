import { NextResponse } from "next/server"
import { getClienteById, createClienteRecord } from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"

// Duplica reale di un cliente. Nota di scope: createClienteRecord copia solo
// i campi che gia' accetta in creazione (nome/contatti/stato/sede/
// installatore/proprietario) — non i sotto-record di dettaglio (impianto,
// pagamenti, logistica, ecc.), che restano da compilare a mano sul nuovo
// record. E' la stessa superficie che oggi supporta "Nuovo cliente", quindi
// nessun rischio di duplicare a metà dati finanziari sensibili per errore.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiRecord("clienti", "create")
  if (guard.response) return guard.response

  const { id } = await params
  const source = await getClienteById(id)
  if (!source) {
    return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 })
  }

  const duplicated = await createClienteRecord({
    ...source,
    "Nome Clienti": `${source["Nome Clienti"]} (copia)`,
  })

  return NextResponse.json(duplicated, { status: 201 })
}
