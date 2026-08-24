import "server-only"

import { createClient, type Session } from "@supabase/supabase-js"

/**
 * Il server MCP non ha una sessione browser: nessun cookie, nessun login
 * interattivo. Per interrogare Supabase come farebbe Vito serve un JWT suo,
 * e l'unico modo di ottenerlo senza conoscerne la password e' la coppia
 * `generateLink` (service_role) + `verifyOtp` (anon) — la stessa tecnica gia'
 * usata su questo progetto per i test E2E.
 *
 * Il service_role compare qui dentro e SOLO qui dentro: serve a coniare il
 * token, mai a leggere o scrivere un dato business. Da quel momento in poi
 * ogni query passa dal JWT, quindi la RLS si applica come per una sessione
 * normale (verificato: `listino_cache` restituisce 0 righe col JWT e 27 in
 * service_role).
 *
 * Il token si tiene in memoria e si rinnova col refresh token: ogni conio
 * crea una riga in `auth.sessions`, che finirebbe in "Sessioni attive". Con
 * la cache la riga e' una per istanza serverless, non una per tool call.
 */

type SessioneVito = {
  accessToken: string
  refreshToken: string
  /** Epoch ms di scadenza dichiarata dal token. */
  scadeAt: number
}

/** Si rinnova con questo anticipo sulla scadenza, mai all'ultimo istante. */
const MARGINE_RINNOVO_MS = 120_000

let sessione: SessioneVito | null = null
/** Conio/rinnovo in corso: evita che N tool call paralleli coniino N sessioni. */
let inVolo: Promise<SessioneVito> | null = null

function env(nome: string): string {
  const valore = process.env[nome]
  if (!valore) throw new Error(`Variabile d'ambiente ${nome} non configurata`)
  return valore
}

function clientAnon() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function clientServiceRole() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function daSessioneSupabase(session: Session | null): SessioneVito {
  if (!session?.access_token || !session.refresh_token) {
    throw new Error("Supabase non ha restituito una sessione utilizzabile")
  }
  // `expires_at` e' in secondi; se manca si ricava dal `expires_in`.
  const scadeAt = session.expires_at
    ? session.expires_at * 1000
    : Date.now() + (session.expires_in ?? 3600) * 1000
  return { accessToken: session.access_token, refreshToken: session.refresh_token, scadeAt }
}

async function conia(): Promise<SessioneVito> {
  const admin = clientServiceRole()
  const userId = env("VITO_USER_ID")

  // L'env var e' l'id utente, non l'email: l'email la risolviamo qui, cosi'
  // un cambio indirizzo non richiede di toccare la configurazione.
  const { data: utente, error: erroreUtente } = await admin.auth.admin.getUserById(userId)
  if (erroreUtente) throw new Error(`Utente MCP non risolto: ${erroreUtente.message}`)
  const email = utente.user?.email
  if (!email) throw new Error(`L'utente ${userId} non ha un'email associata`)

  const { data: link, error: erroreLink } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (erroreLink) throw new Error(`generateLink fallita: ${erroreLink.message}`)
  const hashedToken = link.properties?.hashed_token
  if (!hashedToken) throw new Error("generateLink non ha restituito hashed_token")

  // Il link non viene mai spedito: il token monouso lo consumiamo qui.
  const { data, error } = await clientAnon().auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  })
  if (error) throw new Error(`verifyOtp fallita: ${error.message}`)
  return daSessioneSupabase(data.session)
}

async function rinnova(refreshToken: string): Promise<SessioneVito> {
  const { data, error } = await clientAnon().auth.refreshSession({ refresh_token: refreshToken })
  if (error) throw new Error(`refreshSession fallita: ${error.message}`)
  return daSessioneSupabase(data.session)
}

async function ottieni(): Promise<SessioneVito> {
  const corrente = sessione
  if (corrente && corrente.scadeAt - Date.now() > MARGINE_RINNOVO_MS) return corrente

  // Un refresh fallito non e' fatale: il refresh token puo' essere scaduto o
  // gia' ruotato da un'altra istanza. Si riconia e si va avanti.
  if (corrente?.refreshToken) {
    try {
      sessione = await rinnova(corrente.refreshToken)
      return sessione
    } catch {
      sessione = null
    }
  }

  sessione = await conia()
  return sessione
}

/** Access token valido di Vito. Conia o rinnova solo se serve. */
export async function accessTokenVito(): Promise<string> {
  if (!inVolo) {
    inVolo = ottieni().finally(() => {
      inVolo = null
    })
  }
  return (await inVolo).accessToken
}

/** Solo per i test e per la diagnostica: dimentica la sessione in cache. */
export function scordaSessioneVito(): void {
  sessione = null
  inVolo = null
}
