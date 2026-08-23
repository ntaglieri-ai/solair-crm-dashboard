import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"
import { logAudit } from "@/lib/audit/log"

// Registra l'esito di un tentativo di login. La pagina /login autentica dal
// browser con signInWithPassword, quindi ne' il successo ne' il fallimento
// passano dal server: senza questo endpoint le due metriche "Accessi oggi" e
// "Login falliti" non avrebbero alcuna sorgente.
//
// Non si e' usato /api/auth/session/touch, che il login gia' chiama, perche' lo
// invoca anche il guard di inattivita' a intervalli regolari: ogni keepalive
// sarebbe finito nel registro come un nuovo accesso.
//
// Rotta pubblica per necessita' — un login fallito non ha sessione. Le due
// conseguenze sono gestite qui sotto:
//   - scritture arbitrarie: throttle per IP;
//   - falsi successi: l'esito "success" non e' creduto sulla parola, viene
//     riscritto in base alla sessione realmente presente sulla richiesta.

const IP_LIMIT = 20
const WINDOW_MS = 15 * 60 * 1000

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown"
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

/** L'email va nel registro, ma troncata: e' testo libero mandato dal client. */
function safeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase().slice(0, 120)
  return email.includes("@") ? email : null
}

export async function POST(request: Request) {
  sweepExpired()

  const { allowed } = rateLimit(`audit-login:${clientIp(request)}`, IP_LIMIT, WINDOW_MS)
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 })

  const body = (await request.json().catch(() => null)) as
    | { esito?: string; email?: string }
    | null

  const email = safeEmail(body?.email)

  // Fonte di verita' sull'esito: la sessione allegata alla richiesta. Un client
  // che dichiarasse "success" senza essersi autenticato non puo' iscrivere un
  // accesso mai avvenuto.
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub ?? null
  const riuscito = body?.esito === "success" && Boolean(authUserId)

  if (riuscito) {
    await logAudit({
      tipo_evento: "accesso",
      modulo: "auth",
      descrizione: "Login effettuato",
      esito: "success",
      request,
    })
    return NextResponse.json({ ok: true })
  }

  // Fallimento: nessuna sessione da cui ricavare l'attore. Si prova comunque a
  // collegare l'evento all'utente che qualcuno stava cercando di impersonare,
  // cosi' il filtro per utente mostra i tentativi subiti da quell'account.
  const bersaglio = email ? await utenteDaEmail(email) : null

  await logAudit({
    tipo_evento: "login_fallito",
    modulo: "auth",
    descrizione: email
      ? `Tentativo di accesso fallito con email ${email}`
      : "Tentativo di accesso fallito",
    esito: "failed",
    attore: bersaglio ?? { id: null, nome: null },
    request,
  })

  return NextResponse.json({ ok: true })
}

/**
 * Lookup con service_role: la richiesta non ha sessione, quindi la policy
 * `utenti_select` (che pretende auth.uid()) bloccherebbe la lettura.
 * Non cambia nulla di cio' che il chiamante vede — la risposta e' sempre la
 * stessa — quindi l'endpoint non diventa un oracolo per scoprire quali email
 * sono registrate.
 */
async function utenteDaEmail(email: string): Promise<{ id: string; nome: string | null } | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data } = await admin
    .from("utenti")
    .select("id, nome")
    .ilike("email", email)
    .maybeSingle()

  return data ? { id: data.id, nome: data.nome ?? null } : null
}
