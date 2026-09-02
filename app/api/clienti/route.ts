import { NextResponse, after } from "next/server"
import type { ClienteRecord } from "@/lib/mock-data"
import { parseClientiSearchParams } from "@/lib/clienti/api-types"
import { queryClienti, createClienteRecord } from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { ensureFolder } from "@/lib/nextcloud/admin-webdav"
import { folderPathForRecord } from "@/lib/allegati/paths"

export async function GET(request: Request) {
  const guard = await requireApiRecord("clienti", "view")
  if (guard.response) return guard.response

  const { searchParams } = new URL(request.url)
  const params = parseClientiSearchParams(searchParams)
  const result = await queryClienti(params)

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("clienti", "create")
  if (guard.response) return guard.response

  const body = (await request.json()) as Partial<ClienteRecord>
  if (!body || !body["Nome Clienti"]) {
    return NextResponse.json(
      { error: "Payload cliente non valido: campo 'Nome Clienti' obbligatorio" },
      { status: 400 },
    )
  }
  // L'autore e il proprietario sono concetti distinti: il primo viene dalla sessione.
  body["Creato da"] = guard.permissions.snapshot.subject.nome ?? "Utente CRM"
  const created = await createClienteRecord(body)

  // Cartella Nextcloud creata subito (non al primo upload) cosi' e'
  // raggiungibile anche da PC/telefono senza passare dal CRM — sempre in
  // background, mai bloccante (decisione 25/07, stesso pattern di Lead).
  after(async () => {
    const path = folderPathForRecord("cliente", created.id, created["Nome Clienti"])
    const result = await ensureFolder(path)
    if (!result.ok) {
      console.error(`[allegati] creazione cartella cliente ${created.id} fallita:`, result.error)
    }
  })

  return NextResponse.json(created, { status: 201 })
}
