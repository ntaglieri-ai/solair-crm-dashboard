import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"

type UserPayload = {
  nome: string
  email: string
  ruolo: string
  sede: string
  attivo?: boolean
}

async function resolveRole(supabase: Awaited<ReturnType<typeof createClient>>, code: string) {
  const { data } = await supabase
    .from("ruoli")
    .select("id, code, nome")
    .eq("code", code)
    .maybeSingle()
  return data as { id: string; code: string; nome: string } | null
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
  const ruolo = await resolveRole(supabase, body.ruolo)
  const { data, error } = await supabase
    .from("utenti")
    .insert({
      nome: body.nome.trim(),
      email: body.email.trim().toLowerCase(),
      ruolo: body.ruolo,
      ruolo_id: ruolo?.id ?? null,
      sede: body.sede,
      attivo: body.attivo ?? true,
    })
    .select("id, nome, email, ruolo, ruolo_id, sede, attivo, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ utente: data }, { status: 201 })
}
