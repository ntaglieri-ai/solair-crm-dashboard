import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Supabase e' l'unica fonte password. Nextcloud autentica via OIDC e i client
// desktop/mobile usano token dedicati: modificare password locali Nextcloud
// produrrebbe disallineamenti e notifiche indesiderate.
export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => null)) as { password?: string } | null
  const password = body?.password
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "La password deve avere almeno 8 caratteri" }, { status: 400 })
  }

  const { data: utente, error: userError } = await admin
    .from("utenti")
    .select("id, email")
    .eq("auth_user_id", authUserId)
    .single()
  if (userError || !utente) {
    return NextResponse.json({ error: "Account CRM non trovato" }, { status: 404 })
  }

  const { error: authError } = await admin.auth.admin.updateUserById(authUserId, { password })
  if (authError) {
    return NextResponse.json({ error: `Aggiornamento password CRM fallito: ${authError.message}` }, { status: 500 })
  }

  const { error } = await admin
    .from("utenti")
    .update({ must_change_password: false })
    .eq("auth_user_id", authUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true, email: utente.email })
  // Invalida subito la cache del middleware (scrm_mcp) — altrimenti il
  // cookie resterebbe "1" (deve cambiare password) fino a scadenza,
  // rimandando l'utente in loop su /cambia-password nonostante l'abbia
  // gia' cambiata.
  response.cookies.set("scrm_mcp", "0", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60,
    path: "/",
  })
  return response
}
