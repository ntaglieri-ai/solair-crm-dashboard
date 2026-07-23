import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import { provisionNextcloudUser } from "@/lib/nextcloud/provisioning"

// Rilancio manuale del provisioning Nextcloud per un utente (azione "Riprova"
// dalla UI Account Management). Idempotente lato CRM: riusa lo stesso username.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiAction("crm_settings.account.users.manage")
  if (guard.response) return guard.response

  const { id } = await params
  const supabase = await createClient()
  const { data: utente, error } = await supabase
    .from("utenti")
    .select("id, nome, email, ruolo")
    .eq("id", id)
    .single()

  if (error || !utente) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 })
  }

  const result = await provisionNextcloudUser({
    id: utente.id,
    email: utente.email,
    nome: utente.nome,
    ruolo: utente.ruolo,
  })

  return NextResponse.json({
    nextcloud: { status: result.status, error: result.error, username: result.username },
  })
}
