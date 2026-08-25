/**
 * Costanti e regole del server di autorizzazione del connettore MCP.
 *
 * Modulo puro (nessun I/O, nessun `server-only`): lo caricano sia le rotte sia
 * i test, ed e' il posto unico dove stanno scritte le decisioni di perimetro —
 * chi puo' collegarsi, dove si puo' tornare dopo il login, quanto vivono i
 * token.
 */

// ---------------------------------------------------------------------------
// Chi puo' collegare il connettore

/**
 * I tre ruoli abilitati, con lo stesso identico perimetro: non c'e'
 * differenziazione fra loro qui dentro. Cio' che l'uno vede e l'altro no
 * dipende dalla RLS di Supabase, che vale per la sessione di ciascuno esattamente
 * come nel CRM — questo elenco decide solo chi entra dalla porta.
 */
export const RUOLI_AMMESSI = ["SUPERADMIN", "ADMIN", "DIRECTOR"] as const

export function ruoloAmmesso(ruolo: string | null | undefined): boolean {
  if (!ruolo) return false
  return (RUOLI_AMMESSI as readonly string[]).includes(ruolo.trim().toUpperCase())
}

export const MOTIVO_RUOLO_NON_AMMESSO =
  "Il connettore Claude e' riservato ai ruoli Superadmin, Admin e Direttore. " +
  "Il tuo account non rientra fra questi, quindi il collegamento non e' stato autorizzato."

// ---------------------------------------------------------------------------
// Dove si puo' tornare dopo l'autorizzazione

/**
 * Whitelist rigida dei redirect_uri. Sono gli unici due indirizzi a cui il
 * codice di autorizzazione puo' essere consegnato: entrambi di Anthropic
 * (claude.ai serve anche Desktop e mobile; claude.com e' il dominio nuovo).
 *
 * Il confronto e' per stringa esatta, non per host o per prefisso: un
 * `startsWith` su "https://claude.ai" accetterebbe anche
 * "https://claude.ai.attaccante.tld". Deliberatamente ESCLUSI i redirect di
 * loopback (http://localhost:PORT/callback) che userebbe Claude Code da
 * terminale: l'obiettivo dichiarato e' il connettore di claude.ai, e ogni voce
 * in piu' qui e' un posto in piu' dove un codice puo' finire.
 */
export const REDIRECT_URI_AMMESSI: readonly string[] = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]

export function redirectUriAmmesso(uri: string | null | undefined): boolean {
  if (!uri) return false
  return REDIRECT_URI_AMMESSI.includes(uri)
}

// ---------------------------------------------------------------------------
// Durate

/**
 * Il codice vive un minuto: e' un segreto che viaggia in una query string e
 * finisce nei log del browser e del client. Sessanta secondi bastano
 * abbondantemente allo scambio, che avviene subito dopo il redirect.
 */
export const TTL_CODICE_MS = 60_000
/** Access token: un'ora, come chiesto. Non e' revocabile, ma i controlli su
 *  utente e ruolo si rifanno a ogni richiesta, quindi la finestra di un token
 *  "sopravvissuto" non da' comunque accesso a nulla. */
export const TTL_ACCESS_TOKEN_S = 3600
/** Refresh token: 30 giorni, ruotato a ogni uso e revocabile per utente. */
export const TTL_REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Percorsi

export const PERCORSO_RISORSA_MCP = "/api/mcp"
export const PERCORSO_AUTORIZZAZIONE = "/oauth/mcp/authorize"
export const PERCORSO_TOKEN = "/api/oauth-mcp/token"
export const PERCORSO_REGISTRAZIONE = "/api/oauth-mcp/register"
export const PERCORSO_REVOCA = "/api/oauth-mcp/revoke"
export const PERCORSO_METADATA_AS = "/.well-known/oauth-authorization-server"
export const PERCORSO_METADATA_PR = "/.well-known/oauth-protected-resource"

/** Ambito unico: non ci sono permessi parziali da negoziare. */
export const SCOPE_MCP = "crm:mcp"

/**
 * Origine pubblica da cui e' arrivata la richiesta.
 *
 * Dietro il proxy di Vercel `request.url` puo' portare l'host interno: le
 * intestazioni inoltrate sono la fonte piu' affidabile, e MCP_OAUTH_ISSUER
 * resta come ultima parola se un giorno servisse fissarla a mano.
 */
export function origineRichiesta(request: Request): string {
  const forzata = process.env.MCP_OAUTH_ISSUER
  if (forzata) return forzata.replace(/\/+$/, "")

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (host) {
    const protocollo =
      request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    return `${protocollo}://${host}`
  }
  return new URL(request.url).origin
}

export function risorsaMcp(origine: string): string {
  return `${origine}${PERCORSO_RISORSA_MCP}`
}
