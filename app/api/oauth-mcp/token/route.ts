import { randomUUID } from "node:crypto"

import { after } from "next/server"

import {
  consumaCodice,
  creaRefreshToken,
  pulisciCodiciScaduti,
  ruotaRefreshToken,
} from "@/lib/mcp/oauth/archivio"
import {
  SCOPE_MCP,
  TTL_ACCESS_TOKEN_S,
  origineRichiesta,
  risorsaMcp,
} from "@/lib/mcp/oauth/config"
import { chiaveDiFirma, firmaAccessToken, verificaPkce } from "@/lib/mcp/oauth/cripto"
import { verificaUtenteId } from "@/lib/mcp/oauth/identita"
import { erroreOAuth, ipChiamante, rispostaJson, rispostaPreflight } from "@/lib/mcp/oauth/risposte"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"

/**
 * Scambio del codice con i token, e rinnovo.
 *
 * Client pubblico: non c'e' un client_secret da verificare, e non e' una
 * semplificazione — un segreto dentro un'applicazione che non puo' custodirlo
 * non protegge nulla. A tenere insieme il flusso sono altre tre cose: il
 * codice vale una volta sola e per 60 secondi, PKCE lega lo scambio a chi ha
 * iniziato il flusso, e il redirect_uri e' su whitelist rigida.
 *
 * A ogni emissione — anche sul rinnovo — si rileggono ruolo e stato
 * dell'account dal database. Un refresh token di trenta giorni non deve poter
 * sopravvivere a una disattivazione o a un cambio di ruolo.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LIMITE_PER_IP = 60
const FINESTRA_MS = 10 * 60 * 1000

/** Il corpo puo' arrivare form-encoded (lo standard, e cio' che manda Claude) o JSON. */
async function leggiParametri(request: Request): Promise<URLSearchParams | null> {
  const tipo = request.headers.get("content-type") ?? ""
  try {
    if (tipo.includes("application/json")) {
      const corpo = (await request.json()) as Record<string, unknown>
      const sp = new URLSearchParams()
      for (const [chiave, valore] of Object.entries(corpo)) {
        if (typeof valore === "string") sp.set(chiave, valore)
      }
      return sp
    }
    return new URLSearchParams(await request.text())
  } catch {
    return null
  }
}

function coniaAccessToken(input: {
  origine: string
  risorsa: string
  utenteId: string
  authUserId: string
  ruolo: string
  clientId: string
  scope: string
}): { token: string; scadenzaS: number } {
  const adesso = Math.floor(Date.now() / 1000)
  const token = firmaAccessToken(
    {
      iss: input.origine,
      sub: input.utenteId,
      aud: input.risorsa,
      iat: adesso,
      exp: adesso + TTL_ACCESS_TOKEN_S,
      jti: randomUUID(),
      typ: "mcp-access",
      ruolo: input.ruolo,
      auth_user_id: input.authUserId,
      client_id: input.clientId,
      scope: input.scope,
    },
    chiaveDiFirma(),
  )
  return { token, scadenzaS: TTL_ACCESS_TOKEN_S }
}

export async function POST(request: Request) {
  sweepExpired()
  const { allowed } = rateLimit(`mcp-oauth-token:${ipChiamante(request)}`, LIMITE_PER_IP, FINESTRA_MS)
  if (!allowed) {
    return erroreOAuth("too_many_requests", "Troppe richieste di token: riprova piu' tardi.", 429)
  }

  const sp = await leggiParametri(request)
  if (!sp) return erroreOAuth("invalid_request", "Corpo della richiesta non leggibile.")

  const grantType = sp.get("grant_type")
  const origine = origineRichiesta(request)

  if (grantType === "authorization_code") return await scambiaCodice(sp, origine)
  if (grantType === "refresh_token") return await rinnova(sp, origine)

  return erroreOAuth(
    "unsupported_grant_type",
    "Sono supportati solo authorization_code e refresh_token.",
  )
}

async function scambiaCodice(sp: URLSearchParams, origine: string) {
  const codice = sp.get("code")
  const verifier = sp.get("code_verifier")
  const clientId = sp.get("client_id")
  const redirectUri = sp.get("redirect_uri")

  if (!codice) return erroreOAuth("invalid_request", "Parametro code mancante.")
  if (!verifier) return erroreOAuth("invalid_request", "PKCE obbligatorio: manca code_verifier.")

  const riga = await consumaCodice(codice)
  // Stesso messaggio per "non esiste", "gia' speso" e "scaduto": distinguerli
  // direbbe a chi prova a indovinare quanto e' andato vicino.
  if (!riga) {
    return erroreOAuth("invalid_grant", "Codice non valido, gia' utilizzato o scaduto.")
  }

  if (clientId && clientId !== riga.client_id) {
    return erroreOAuth("invalid_grant", "Il codice appartiene a un altro client.")
  }
  if (redirectUri && redirectUri !== riga.redirect_uri) {
    return erroreOAuth("invalid_grant", "redirect_uri diverso da quello dell'autorizzazione.")
  }
  if (!verificaPkce(verifier, riga.code_challenge, riga.code_challenge_method)) {
    return erroreOAuth("invalid_grant", "code_verifier non corrisponde al code_challenge.")
  }

  // Il ruolo nel codice e' di 60 secondi fa: vale comunque quello di adesso.
  const esito = await verificaUtenteId(riga.utente_id)
  if (!esito.ok) return erroreOAuth("invalid_grant", esito.descrizione, esito.stato === 503 ? 503 : 403)

  const refreshToken = await creaRefreshToken({
    clientId: riga.client_id,
    utenteId: esito.identita.utenteId,
    authUserId: esito.identita.authUserId,
  })

  after(() => void pulisciCodiciScaduti())

  return rispondiConToken({
    origine,
    risorsa: riga.resource ?? risorsaMcp(origine),
    identita: esito.identita,
    clientId: riga.client_id,
    scope: riga.scope ?? SCOPE_MCP,
    refreshToken,
  })
}

async function rinnova(sp: URLSearchParams, origine: string) {
  const token = sp.get("refresh_token")
  const clientId = sp.get("client_id")
  if (!token) return erroreOAuth("invalid_request", "Parametro refresh_token mancante.")

  const rotazione = await ruotaRefreshToken(token)
  if (!rotazione) {
    return erroreOAuth("invalid_grant", "Refresh token non valido, revocato o scaduto.")
  }
  if (clientId && clientId !== rotazione.riga.client_id) {
    return erroreOAuth("invalid_grant", "Il refresh token appartiene a un altro client.")
  }

  const esito = await verificaUtenteId(rotazione.riga.utente_id)
  if (!esito.ok) return erroreOAuth("invalid_grant", esito.descrizione, esito.stato === 503 ? 503 : 403)

  return rispondiConToken({
    origine,
    risorsa: risorsaMcp(origine),
    identita: esito.identita,
    clientId: rotazione.riga.client_id,
    scope: SCOPE_MCP,
    refreshToken: rotazione.nuovoToken,
  })
}

function rispondiConToken(input: {
  origine: string
  risorsa: string
  identita: { utenteId: string; authUserId: string; ruolo: string }
  clientId: string
  scope: string
  refreshToken: string
}) {
  const { token, scadenzaS } = coniaAccessToken({
    origine: input.origine,
    risorsa: input.risorsa,
    utenteId: input.identita.utenteId,
    authUserId: input.identita.authUserId,
    ruolo: input.identita.ruolo,
    clientId: input.clientId,
    scope: input.scope,
  })

  console.log(
    `[mcp-oauth] token emesso utente=${input.identita.utenteId} ruolo=${input.identita.ruolo} client=${input.clientId}`,
  )

  return rispostaJson({
    access_token: token,
    token_type: "Bearer",
    expires_in: scadenzaS,
    refresh_token: input.refreshToken,
    scope: input.scope,
  })
}

export async function OPTIONS() {
  return rispostaPreflight()
}
