import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"
import { clientIp, logAudit } from "@/lib/audit/log"
import { setCrmSessionCookies } from "@/lib/auth/session-policy"
import { leggiImpostazioniSicurezza } from "@/lib/session-access/security-settings"
import {
  applicaBloccoSeNecessario,
  controllaIpBloccato,
} from "@/lib/session-access/login-guard"
import {
  DURATA_BLOCCO_MINUTI,
  clampTimeoutMinuti,
} from "@/lib/session-access/constants"

// Autenticazione del CRM.
//
// Fino al 23/08/2026 il login avveniva nel browser (signInWithPassword su
// /login) e il server veniva avvisato solo dopo, per l'audit. Con quella forma
// le impostazioni "Tentativi di login massimi" e "Blocco IP" erano
// strutturalmente inapplicabili: nessun codice nostro girava prima di Supabase.
// Spostare l'autenticazione qui e' cio' che le rende vere.
//
// Ordine delle operazioni, non arbitrario:
//   1. throttle per IP        — prima di toccare il database;
//   2. IP bloccato?           — si esce senza nemmeno chiamare Supabase;
//   3. signInWithPassword     — lato server, i cookie sb-* finiscono in risposta;
//   4. registrazione esito    — success o login_fallito;
//   5. eventuale blocco       — solo dopo un fallimento.
//
// Rotta pubblica per necessita': chi fa login non ha ancora una sessione.

// Throttle di prima linea, indipendente dalla soglia configurabile: e' in
// memoria di processo (vedi lib/rate-limit) e serve solo a smorzare le raffiche
// piu' grossolane prima che diventino righe di registro.
const THROTTLE_LIMITE = 30
const THROTTLE_FINESTRA_MS = 15 * 60 * 1000

/** Unico messaggio di errore per ogni fallimento di credenziali. */
const CREDENZIALI_ERRATE = "Email o password non corretti."

function emailPulita(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase().slice(0, 120)
  return email.includes("@") ? email : null
}

/**
 * Utente CRM corrispondente all'email tentata. Serve solo al registro, per
 * collegare i tentativi falliti all'account bersaglio: la risposta al chiamante
 * non cambia mai in base a questo esito, quindi l'endpoint non diventa un modo
 * per scoprire quali indirizzi sono registrati.
 */
async function utenteDaEmail(
  email: string,
): Promise<{ id: string; nome: string | null } | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data } = await admin
    .from("utenti")
    .select("id, nome")
    .ilike("email", email)
    .maybeSingle()

  return data ? { id: data.id, nome: data.nome ?? null } : null
}

/**
 * Intestazioni da far arrivare a Supabase Auth cosi' come le ha mandate il
 * browser. Lo user agent viene troncato: e' testo libero del client e finisce
 * in una colonna di database.
 */
function intestazioniOriginali(request: Request, ip: string | null): Record<string, string> {
  const headers: Record<string, string> = {}

  const userAgent = request.headers.get("user-agent")
  if (userAgent) headers["User-Agent"] = userAgent.slice(0, 400)
  if (ip) headers["X-Forwarded-For"] = ip

  return headers
}

/** Utente CRM a partire dall'id di Supabase Auth, per attribuire l'accesso. */
async function utenteDaAuthId(
  authUserId: string,
): Promise<{ id: string; nome: string | null } | null> {
  const admin = createAdminClient()
  if (!admin) return null

  const { data } = await admin
    .from("utenti")
    .select("id, nome")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  return data ? { id: data.id, nome: data.nome ?? null } : null
}

export async function POST(request: Request) {
  sweepExpired()

  const ip = clientIp(request)
  const { allowed } = rateLimit(`login:${ip ?? "sconosciuto"}`, THROTTLE_LIMITE, THROTTLE_FINESTRA_MS)
  if (!allowed) {
    return NextResponse.json(
      { error: "Troppi tentativi. Riprova tra qualche minuto." },
      { status: 429 },
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null

  const email = emailPulita(body?.email)
  const password = typeof body?.password === "string" ? body.password : ""

  if (!email || !password) {
    return NextResponse.json({ error: CREDENZIALI_ERRATE }, { status: 400 })
  }

  const { impostazioni } = await leggiImpostazioniSicurezza()

  // --- 2. IP bloccato -------------------------------------------------------
  // Il controllo precede la chiamata a Supabase: un IP sotto blocco non deve
  // poter nemmeno verificare se una password e' giusta.
  if (impostazioni.bloccoIpAttivo) {
    const blocco = await controllaIpBloccato(ip)
    if (blocco.bloccato) {
      const bersaglio = await utenteDaEmail(email)
      await logAudit({
        tipo_evento: "login_fallito",
        modulo: "auth",
        descrizione: `Tentativo di accesso da IP bloccato (${email})`,
        esito: "failed",
        attore: bersaglio ?? { id: null, nome: null },
        request,
      })

      return NextResponse.json(
        {
          error:
            "Questo indirizzo IP è temporaneamente bloccato per troppi tentativi falliti. Riprova più tardi.",
          bloccato: true,
          scadenza: blocco.scadenza,
        },
        { status: 403 },
      )
    }
  }

  // --- 3. Autenticazione ----------------------------------------------------
  // createClient() usa l'adattatore cookie di next/headers: a login riuscito i
  // cookie sb-* vengono scritti sulla risposta di questa route. Non sono
  // httpOnly (default di @supabase/ssr), quindi il client browser li rilegge
  // da solo — stesso meccanismo gia' usato da /api/auth/logout al contrario.
  //
  // User-Agent e X-Forwarded-For originali vengono inoltrati: GoTrue li scrive
  // in auth.sessions, che e' la sorgente della tabella "Sessioni attive". Senza
  // inoltro ogni riga direbbe "node" e l'IP di uscita del server, perche' da
  // quando il login e' server-side la richiesta che Supabase vede parte da noi
  // e non dal browser. Misurato: prima dell'inoltro le sessioni di prova
  // risultavano tutte identiche e prive di postazione.
  const supabase = await createClient({ headers: intestazioniOriginali(request, ip) })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // --- 4/5. Fallimento ------------------------------------------------------
  if (error || !data.user) {
    const bersaglio = await utenteDaEmail(email)

    // Atteso, non lanciato in sottofondo: il conteggio del passo successivo
    // deve poter vedere questa riga, altrimenti la soglia scatterebbe con un
    // tentativo di ritardo.
    await logAudit({
      tipo_evento: "login_fallito",
      modulo: "auth",
      descrizione: `Tentativo di accesso fallito con email ${email}`,
      esito: "failed",
      attore: bersaglio ?? { id: null, nome: null },
      request,
    })

    const { bloccato, tentativi } = await applicaBloccoSeNecessario(ip, impostazioni)

    if (bloccato) {
      await logAudit({
        tipo_evento: "operazione_admin",
        modulo: "auth",
        descrizione: `IP ${ip} bloccato automaticamente dopo ${tentativi} tentativi falliti (durata ${DURATA_BLOCCO_MINUTI} minuti)`,
        esito: "success",
        attore: { id: null, nome: null },
        request,
      })

      return NextResponse.json(
        {
          error:
            "Questo indirizzo IP è stato temporaneamente bloccato per troppi tentativi falliti.",
          bloccato: true,
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ error: CREDENZIALI_ERRATE }, { status: 401 })
  }

  // --- 4. Successo ----------------------------------------------------------
  // Il timeout di inattivita' viene stampato nei cookie adesso: il middleware lo
  // rilegge a ogni richiesta senza interrogare il database.
  const timeoutSecondi = clampTimeoutMinuti(impostazioni.timeoutMinuti) * 60

  const response = NextResponse.json({ ok: true, timeoutSeconds: timeoutSecondi })
  response.headers.set("Cache-Control", "no-store")
  setCrmSessionCookies(response, timeoutSecondi)

  // L'attore viene risolto da data.user, non lasciato dedurre dalla sessione.
  // logAudit() senza `attore` ricava l'identita' rileggendo i cookie della
  // richiesta: qui i cookie di sessione sono appena stati scritti sulla
  // RISPOSTA, quindi dipendere da quella rilettura significherebbe affidare
  // l'unica informazione per cui il registro esiste a un dettaglio di
  // propagazione. Con l'id in mano la riga e' attribuita con certezza.
  const autore = await utenteDaAuthId(data.user.id)

  await logAudit({
    tipo_evento: "accesso",
    modulo: "auth",
    descrizione: "Login effettuato",
    esito: "success",
    attore: autore ?? { id: null, nome: null },
    request,
  })

  return response
}
