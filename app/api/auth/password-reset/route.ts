import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPasswordReset } from "@/lib/auth/user-provisioning"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"

// Endpoint PUBBLICO (nessun requireApiAction): serve la pagina di login per il
// flusso self-service "Password dimenticata?". Riusa esattamente la stessa
// infrastruttura di onboarding (password temporanea + must_change_password +
// /cambia-password): genera una nuova password temporanea, la imposta
// sull'account Auth e la invia via email.
//
// Privacy: la risposta e' SEMPRE lo stesso messaggio neutro, sia che l'email
// esista sia che non esista, per non rivelare quali indirizzi sono utenti CRM.
//
// Rate-limit: throttle in-memory per email e per IP (vedi lib/rate-limit.ts).

// Massimo 3 richieste ogni 15 minuti per email, 10 per IP.
const EMAIL_LIMIT = 3
const IP_LIMIT = 10
const WINDOW_MS = 15 * 60 * 1000

const NEUTRAL_MESSAGE =
  "Se l'indirizzo è registrato, riceverai una email a breve con le istruzioni per accedere."

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}

export async function POST(request: Request) {
  sweepExpired()

  const body = (await request.json().catch(() => null)) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()

  // Input non valido: rispondiamo comunque neutro per non differenziare i casi.
  if (!email || !email.includes("@")) {
    return NextResponse.json({ message: NEUTRAL_MESSAGE })
  }

  // Rate-limit per IP e per email. Se superato, risposta neutra con 429 cosi'
  // il client puo' comunicare "riprova piu' tardi" senza rivelare nulla.
  const ip = clientIp(request)
  const ipCheck = rateLimit(`pwreset:ip:${ip}`, IP_LIMIT, WINDOW_MS)
  const emailCheck = rateLimit(`pwreset:email:${email}`, EMAIL_LIMIT, WINDOW_MS)
  if (!ipCheck.allowed || !emailCheck.allowed) {
    const retryAfterMs = Math.max(ipCheck.retryAfterMs, emailCheck.retryAfterMs)
    return NextResponse.json(
      { message: NEUTRAL_MESSAGE },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      },
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    console.error("[password-reset] SUPABASE_SERVICE_ROLE_KEY non configurata")
    // Non riveliamo un problema di configurazione all'utente: messaggio neutro.
    return NextResponse.json({ message: NEUTRAL_MESSAGE })
  }

  // Lookup con service role (bypassa RLS: l'endpoint e' pubblico e non c'e'
  // sessione). Selezioniamo solo lo stretto necessario.
  const { data: utente, error } = await admin
    .from("utenti")
    .select("id, nome, email, auth_user_id, attivo")
    .eq("email", email)
    .maybeSingle()

  if (error) {
    console.error("[password-reset] lookup utente fallito:", error)
    return NextResponse.json({ message: NEUTRAL_MESSAGE })
  }

  // Nessun utente, utente disattivato o senza account Auth: usciamo neutri
  // senza fare nulla. Non riveliamo la differenza.
  if (!utente || !utente.auth_user_id || utente.attivo === false) {
    return NextResponse.json({ message: NEUTRAL_MESSAGE })
  }

  const result = await sendPasswordReset({
    id: utente.id,
    email: utente.email,
    nome: utente.nome,
    auth_user_id: utente.auth_user_id,
  })

  if (result.error) {
    console.error(`[password-reset] reset fallito per utente ${utente.id}:`, result.error)
  }
  if (result.emailStatus !== "sent") {
    console.error(
      `[password-reset] invio email ${result.emailStatus} per utente ${utente.id}:`,
      result.emailError,
    )
  }

  // Sempre e comunque neutro, anche se l'invio email e' fallito lato server.
  return NextResponse.json({ message: NEUTRAL_MESSAGE })
}
