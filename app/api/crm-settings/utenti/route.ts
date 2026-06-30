import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import {
  accountRoleErrorMessage,
  resolveRole,
} from "@/lib/crm-settings/roles"

type UserPayload = {
  nome: string
  email: string
  ruolo: string
  sede: string
  attivo?: boolean
}

export async function GET() {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const supabase = await createClient()
  const [{ data: utenti, error: utentiError }, { data: ruoli, error: ruoliError }] =
    await Promise.all([
      supabase
        .from("utenti")
        .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
        .order("nome"),
      supabase
        .from("ruoli")
        .select("id, code, nome")
        .order("ordinamento", { ascending: true }),
    ])

  const error = utentiError ?? ruoliError
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ utenti: utenti ?? [], ruoli: ruoli ?? [] })
}

export async function POST(request: Request) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const body = (await request.json().catch(() => null)) as UserPayload | null
  if (!body?.nome?.trim() || !body.email?.trim() || !body.ruolo || !body.sede) {
    return NextResponse.json({ error: "Payload utente non valido" }, { status: 400 })
  }

  const supabase = await createClient()
  const ruolo = await resolveRole(supabase, body.ruolo).catch(() => null)
  if (!ruolo) {
    return NextResponse.json(
      { error: "Il ruolo selezionato non esiste o non è più disponibile." },
      { status: 400 },
    )
  }
  const { data, error } = await supabase
    .from("utenti")
    .insert({
      nome: body.nome.trim(),
      email: body.email.trim().toLowerCase(),
      ruolo: ruolo.code,
      ruolo_id: ruolo.id,
      sede: body.sede,
      attivo: body.attivo ?? true,
    })
    .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
    .single()

  if (error) {
    return NextResponse.json(
      { error: accountRoleErrorMessage(error.message) },
      { status: 500 },
    )
  }

  return NextResponse.json({ utente: data }, { status: 201 })
}
