import { NextResponse, after } from "next/server"
import type { Lead } from "@/lib/mock-data"
import { parseLeadsSearchParams } from "@/lib/leads/api-types"
import { queryLeadsTrusted, createLeadRecord } from "@/lib/leads/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { provisionaCartellaRecord } from "@/lib/allegati/provisioning"

export async function GET(request: Request) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const params = parseLeadsSearchParams(searchParams)
    const result = await queryLeadsTrusted(params)
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore caricamento Lead"
    console.error("[api/leads]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("lead", "create")
  if (guard.response) return guard.response

  const body = (await request.json()) as Lead
  if (!body || !body.id || !body["Nome Lead"]) {
    return NextResponse.json(
      { error: "Payload lead non valido" },
      { status: 400 },
    )
  }
  // L'autore viene dalla sessione, mai dal proprietario scelto nel form e mai da un UUID mostrabile.
  body["Creato da"] = guard.permissions.snapshot.subject.nome ?? "Utente CRM"
  const created = await createLeadRecord(body)

  // Cartella Nextcloud creata subito (non al primo upload) cosi' e'
  // raggiungibile anche da PC/telefono senza passare dal CRM — sempre in
  // background, mai bloccante: se Nextcloud e' giu' la creazione del lead
  // non deve fallire per questo (decisione 25/07).
  after(async () => {
    const result = await provisionaCartellaRecord("lead", created.id, created["Nome Lead"] ?? "")
    if (!result.ok) {
      console.error(`[allegati] creazione cartella lead ${created.id} fallita:`, result.error)
    }
  })

  return NextResponse.json(created, { status: 201 })
}
