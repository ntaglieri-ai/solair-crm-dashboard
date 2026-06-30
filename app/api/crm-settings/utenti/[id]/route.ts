import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  accountRoleErrorMessage,
  resolveRole,
} from "@/lib/crm-settings/roles"

type PatchPayload = {
  nome?: string
  email?: string
  ruolo?: string
  sede?: string
  attivo?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const body = (await request.json().catch(() => null)) as PatchPayload | null
  if (!body) {
    return NextResponse.json({ error: "Payload utente non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const patch: Record<string, unknown> = {}
  if (body.nome !== undefined) patch.nome = body.nome.trim()
  if (body.email !== undefined) patch.email = body.email.trim().toLowerCase()
  if (body.sede !== undefined) patch.sede = body.sede
  if (body.attivo !== undefined) patch.attivo = body.attivo
  if (body.ruolo !== undefined) {
    const ruolo = await resolveRole(supabase, body.ruolo).catch(() => null)
    if (!ruolo) {
      return NextResponse.json(
        { error: "Il ruolo selezionato non esiste o non è più disponibile." },
        { status: 400 },
      )
    }
    patch.ruolo = ruolo.code
    patch.ruolo_id = ruolo.id
  }

  const { data, error } = await supabase
    .from("utenti")
    .update(patch)
    .eq("id", id)
    .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
    .single()

  if (error) {
    return NextResponse.json(
      { error: accountRoleErrorMessage(error.message) },
      { status: 500 },
    )
  }

  return NextResponse.json({ utente: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from("utenti").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
