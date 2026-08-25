import { ErroreTokenMcp, firmaJws, verificaJws } from "@/lib/mcp/oauth/cripto"
import { redirectUriAmmesso } from "@/lib/mcp/oauth/config"

/**
 * La richiesta di autorizzazione, dal momento in cui arriva a /authorize fino
 * al click di conferma.
 *
 * Fra i due momenti c'e' un login sul CRM, quindi i parametri devono
 * sopravvivere a un giro completo nel browser. Invece di rimetterli in campi
 * nascosti — dove chiunque potrebbe cambiarli fra la pagina e il POST — si
 * consegnano come un unico token firmato: se il redirect_uri viene toccato, la
 * firma non torna e la conferma viene rifiutata.
 *
 * Il token porta dentro anche l'utente che ha visto la pagina. E' cio' che
 * rende inutile un CSRF sul pulsante di conferma: un POST partito da un altro
 * sito arriverebbe con i cookie della vittima ma con un token firmato per un
 * altro utente, e i due non coinciderebbero.
 */

export type ParametriAutorizzazione = {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  state: string | null
  scope: string | null
  resource: string | null
}

export type EsitoParametri =
  | { ok: true; parametri: ParametriAutorizzazione }
  /** Errore da mostrare a schermo: il redirect_uri non e' affidabile. */
  | { ok: false; fatale: true; descrizione: string }
  /** Errore da rimandare al client sul redirect_uri, come chiede OAuth. */
  | { ok: false; fatale: false; codice: string; descrizione: string; redirectUri: string; state: string | null }

function pulisci(valore: string | null | undefined, max = 512): string | null {
  if (typeof valore !== "string") return null
  const v = valore.trim()
  return v ? v.slice(0, max) : null
}

/**
 * Controlli sintattici sui parametri di /authorize, senza toccare il database.
 *
 * L'ordine non e' casuale: prima si stabilisce se il redirect_uri e'
 * affidabile, poi tutto il resto. Un errore segnalato rimandando il browser a
 * un indirizzo non verificato sarebbe un redirect aperto — quindi finche' il
 * redirect_uri non ha passato la whitelist, ogni errore resta a schermo.
 */
export function analizzaParametri(sp: URLSearchParams): EsitoParametri {
  const redirectUri = pulisci(sp.get("redirect_uri"))
  if (!redirectUri) {
    return { ok: false, fatale: true, descrizione: "Richiesta priva di redirect_uri." }
  }
  if (!redirectUriAmmesso(redirectUri)) {
    return {
      ok: false,
      fatale: true,
      descrizione:
        `L'indirizzo di ritorno "${redirectUri}" non e' fra quelli ammessi. ` +
        "Il connettore accetta solo i callback ufficiali di Claude.",
    }
  }

  const state = pulisci(sp.get("state"))
  const clientId = pulisci(sp.get("client_id"), 128)
  const rifiuta = (codice: string, descrizione: string): EsitoParametri => ({
    ok: false,
    fatale: false,
    codice,
    descrizione,
    redirectUri,
    state,
  })

  if (!clientId) return rifiuta("invalid_request", "Parametro client_id mancante.")

  const responseType = pulisci(sp.get("response_type"), 32)
  if (responseType !== "code") {
    return rifiuta("unsupported_response_type", "Solo response_type=code e' supportato.")
  }

  const codeChallenge = pulisci(sp.get("code_challenge"), 256)
  if (!codeChallenge) {
    return rifiuta("invalid_request", "PKCE obbligatorio: manca code_challenge.")
  }
  const codeChallengeMethod = pulisci(sp.get("code_challenge_method"), 16) ?? "S256"
  if (codeChallengeMethod !== "S256") {
    return rifiuta("invalid_request", "L'unico code_challenge_method accettato e' S256.")
  }

  return {
    ok: true,
    parametri: {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      scope: pulisci(sp.get("scope"), 256),
      resource: pulisci(sp.get("resource")),
    },
  }
}

/** Quanto tempo ha l'utente per confermare dopo aver visto la pagina. */
const TTL_RICHIESTA_MS = 10 * 60 * 1000

export function firmaRichiesta(
  parametri: ParametriAutorizzazione,
  authUserId: string,
  chiave: string,
): string {
  return firmaJws(
    {
      typ: "mcp-authz-req",
      exp: Math.floor((Date.now() + TTL_RICHIESTA_MS) / 1000),
      sub: authUserId,
      client_id: parametri.clientId,
      redirect_uri: parametri.redirectUri,
      code_challenge: parametri.codeChallenge,
      code_challenge_method: parametri.codeChallengeMethod,
      state: parametri.state,
      scope: parametri.scope,
      resource: parametri.resource,
    },
    chiave,
  )
}

export function verificaRichiesta(
  token: string,
  chiave: string,
): { parametri: ParametriAutorizzazione; authUserId: string } {
  const payload = verificaJws(token, chiave)
  if (payload.typ !== "mcp-authz-req") throw new ErroreTokenMcp("Token di richiesta non valido")

  const redirectUri = String(payload.redirect_uri ?? "")
  // La whitelist si riapplica anche qui: firmata o no, una richiesta che punta
  // altrove non deve poter produrre un codice.
  if (!redirectUriAmmesso(redirectUri)) throw new ErroreTokenMcp("redirect_uri non ammesso")

  const authUserId = String(payload.sub ?? "")
  if (!authUserId) throw new ErroreTokenMcp("Token di richiesta privo di utente")

  return {
    authUserId,
    parametri: {
      clientId: String(payload.client_id ?? ""),
      redirectUri,
      codeChallenge: String(payload.code_challenge ?? ""),
      codeChallengeMethod: String(payload.code_challenge_method ?? "S256"),
      state: payload.state == null ? null : String(payload.state),
      scope: payload.scope == null ? null : String(payload.scope),
      resource: payload.resource == null ? null : String(payload.resource),
    },
  }
}

/** URL di ritorno al client, con codice o con errore, `state` incluso se c'era. */
export function urlDiRitorno(
  redirectUri: string,
  parametri: Record<string, string | null>,
): string {
  const url = new URL(redirectUri)
  for (const [chiave, valore] of Object.entries(parametri)) {
    if (valore != null) url.searchParams.set(chiave, valore)
  }
  return url.toString()
}
