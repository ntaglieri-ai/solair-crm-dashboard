import "server-only"

import { createClient, type Session } from "@supabase/supabase-js"

/**
 * JWT Supabase dell'utente che sta usando il server MCP.
 *
 * Il server MCP non ha una sessione browser: nessun cookie, nessun login
 * interattivo. Per interrogare Supabase come farebbe quella persona serve un
 * JWT suo, e l'unico modo di ottenerlo senza conoscerne la password e' la
 * coppia `generateLink` (service_role) + `verifyOtp` (anon) — la stessa
 * tecnica gia' usata su questo progetto per i test E2E.
 *
 * Il service_role compare qui dentro e SOLO qui dentro: serve a coniare il
 * token, mai a leggere o scrivere un dato business. Da quel momento in poi
 * ogni query passa dal JWT, quindi la RLS si applica come per una sessione
 * normale (verificato: `listino_cache` restituisce 0 righe col JWT e 27 in
 * service_role).
 *
 * Dal 25/08/2026 la cache e' per utente e non piu' una sola: il connettore e'
 * multi-utente, e due persone che chiamano la stessa istanza serverless devono
 * ottenere due sessioni distinte. Se la cache restasse unica, la seconda
 * leggerebbe i dati con il JWT della prima — cioe' con la RLS di qualcun
 * altro. E' il motivo per cui la chiave della mappa e' l'auth user id e non
 * c'e' nessuna variabile globale "utente corrente".
 *
 * Ogni conio crea una riga in `auth.sessions`, che finirebbe in "Sessioni
 * attive": con la cache la riga e' una per utente per istanza serverless, non
 * una per tool call.
 */

type SessioneUtente = {
  accessToken: string
  refreshToken: string
  /** Epoch ms di scadenza dichiarata dal token. */
  scadeAt: number
}

/** Si rinnova con questo anticipo sulla scadenza, mai all'ultimo istante. */
const MARGINE_RINNOVO_MS = 120_000

/**
 * Quante sessioni tenere in memoria per istanza. Il tetto esiste perche' la
 * mappa vive quanto l'istanza serverless: senza, un'istanza longeva
 * accumulerebbe una sessione per ogni utente che passa di li'.
 */
const MAX_SESSIONI = 20

const sessioni = new Map<string, SessioneUtente>()
/** Conio/rinnovo in corso: evita che N tool call paralleli coniino N sessioni. */
const inVolo = new Map<string, Promise<SessioneUtente>>()

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

function daSessioneSupabase(session: Session | null): SessioneUtente {
  if (!session?.access_token || !session.refresh_token) {
    throw new Error("Supabase non ha restituito una sessione utilizzabile")
  }
  // `expires_at` e' in secondi; se manca si ricava dal `expires_in`.
  const scadeAt = session.expires_at
    ? session.expires_at * 1000
    : Date.now() + (session.expires_in ?? 3600) * 1000
  return { accessToken: session.access_token, refreshToken: session.refresh_token, scadeAt }
}

async function conia(authUserId: string): Promise<SessioneUtente> {
  const admin = clientServiceRole()

  // Si parte dall'id e non dall'email: un cambio indirizzo non deve rompere
  // il collegamento gia' autorizzato.
  const { data: utente, error: erroreUtente } = await admin.auth.admin.getUserById(authUserId)
  if (erroreUtente) throw new Error(`Utente MCP non risolto: ${erroreUtente.message}`)
  const email = utente.user?.email
  if (!email) throw new Error(`L'utente ${authUserId} non ha un'email associata`)

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

async function rinnova(refreshToken: string): Promise<SessioneUtente> {
  const { data, error } = await clientAnon().auth.refreshSession({ refresh_token: refreshToken })
  if (error) throw new Error(`refreshSession fallita: ${error.message}`)
  return daSessioneSupabase(data.session)
}

function potaCache(): void {
  if (sessioni.size <= MAX_SESSIONI) return
  const adesso = Date.now()
  for (const [chiave, sessione] of sessioni) {
    if (sessione.scadeAt <= adesso) sessioni.delete(chiave)
  }
  // Se non bastasse, si buttano le piu' vecchie: riconiarle costa una
  // chiamata, tenerle tutte costa memoria per sempre.
  while (sessioni.size > MAX_SESSIONI) {
    const primaChiave = sessioni.keys().next().value
    if (primaChiave === undefined) break
    sessioni.delete(primaChiave)
  }
}

async function ottieni(authUserId: string): Promise<SessioneUtente> {
  const corrente = sessioni.get(authUserId)
  if (corrente && corrente.scadeAt - Date.now() > MARGINE_RINNOVO_MS) return corrente

  // Un refresh fallito non e' fatale: il refresh token puo' essere scaduto o
  // gia' ruotato da un'altra istanza. Si riconia e si va avanti.
  if (corrente?.refreshToken) {
    try {
      const rinnovata = await rinnova(corrente.refreshToken)
      sessioni.set(authUserId, rinnovata)
      return rinnovata
    } catch {
      sessioni.delete(authUserId)
    }
  }

  const nuova = await conia(authUserId)
  sessioni.set(authUserId, nuova)
  potaCache()
  return nuova
}

/** Access token Supabase valido per quell'utente. Conia o rinnova solo se serve. */
export async function accessTokenUtente(authUserId: string): Promise<string> {
  if (!authUserId) throw new Error("accessTokenUtente richiede un auth user id")

  let promessa = inVolo.get(authUserId)
  if (!promessa) {
    promessa = ottieni(authUserId).finally(() => {
      inVolo.delete(authUserId)
    })
    inVolo.set(authUserId, promessa)
  }
  return (await promessa).accessToken
}

/** Solo per i test e per la diagnostica: dimentica le sessioni in cache. */
export function scordaSessioniMcp(authUserId?: string): void {
  if (authUserId) {
    sessioni.delete(authUserId)
    inVolo.delete(authUserId)
    return
  }
  sessioni.clear()
  inVolo.clear()
}
