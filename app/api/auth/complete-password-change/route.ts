import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Chiamata dalla pagina /cambia-password DOPO che il client ha gia' aggiornato
// la password via supabase.auth.updateUser(). Qui azzeriamo solo il flag
// must_change_password per l'utente autenticato corrente: usiamo il service
// role (bypassa RLS) perche' l'id e' derivato dal JWT verificato server-side,
// non da input utente, quindi non serve/ha senso un permesso "gestione utenti".
export async function POST() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const authUserId = claimsData?.claims?.sub
  if (typeof authUserId !== "string") {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY non configurata" },
      { status: 500 },
    )
  }

  const { error } = await admin
    .from("utenti")
    .update({ must_change_password: false })
    .eq("auth_user_id", authUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
