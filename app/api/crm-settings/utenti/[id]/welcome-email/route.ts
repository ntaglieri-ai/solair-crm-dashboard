import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiAction } from "@/lib/permissions/server"
import { retryWelcomeEmail } from "@/lib/auth/user-provisioning"

// Rilancio manuale dell'invio email di benvenuto / password temporanea per un
// utente (azione "Riprova" dalla UI Account Management). Genera una nuova
// password temporanea e la reinvia: non conosciamo piu' in chiaro quella
// iniziale, quindi non possiamo semplicemente rispedire la stessa.
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
    .select("id, nome, email, auth_user_id")
    .eq("id", id)
    .single()

  if (error || !utente) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 })
  }

  const result = await retryWelcomeEmail(utente)

  return NextResponse.json({
    auth: { error: result.error },
    utente: {
      welcome_email_status: result.emailStatus,
      welcome_email_error: result.emailError,
    },
  })
}
