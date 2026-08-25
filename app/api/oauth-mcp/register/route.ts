import { REDIRECT_URI_AMMESSI, SCOPE_MCP, redirectUriAmmesso } from "@/lib/mcp/oauth/config"
import { registraClient } from "@/lib/mcp/oauth/archivio"
import { erroreOAuth, ipChiamante, rispostaJson, rispostaPreflight } from "@/lib/mcp/oauth/risposte"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"

/**
 * Registrazione dinamica del client (RFC 7591).
 *
 * Claude non ha un client_id preconcordato con noi: quando si aggiunge il
 * connettore, lo chiede qui. Senza questo endpoint il collegamento si ferma
 * prima ancora di mostrare la pagina di login — e' l'altro pezzo che mancava
 * insieme ai metadata.
 *
 * L'endpoint e' aperto (non puo' essere altrimenti: chi registra non ha ancora
 * credenziali), ma non e' permissivo: un client puo' nascere SOLO con i
 * redirect_uri della whitelist. Registrarsi non da' alcun accesso ai dati, da'
 * solo un identificativo da presentare a /authorize, dove poi serve comunque
 * un login CRM con un ruolo ammesso.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LIMITE_PER_IP = 20
const FINESTRA_MS = 60 * 60 * 1000

type CorpoRegistrazione = {
  client_name?: unknown
  redirect_uris?: unknown
  grant_types?: unknown
  token_endpoint_auth_method?: unknown
}

export async function POST(request: Request) {
  sweepExpired()
  const { allowed } = rateLimit(`mcp-oauth-register:${ipChiamante(request)}`, LIMITE_PER_IP, FINESTRA_MS)
  if (!allowed) {
    return erroreOAuth("too_many_requests", "Troppe registrazioni: riprova piu' tardi.", 429)
  }

  const corpo = (await request.json().catch(() => null)) as CorpoRegistrazione | null
  if (!corpo) return erroreOAuth("invalid_client_metadata", "Corpo della richiesta non leggibile.")

  const redirectUris = Array.isArray(corpo.redirect_uris)
    ? corpo.redirect_uris.filter((u): u is string => typeof u === "string")
    : []

  if (redirectUris.length === 0) {
    return erroreOAuth("invalid_redirect_uri", "Serve almeno un redirect_uri.")
  }

  const nonAmmessi = redirectUris.filter((uri) => !redirectUriAmmesso(uri))
  if (nonAmmessi.length > 0) {
    return erroreOAuth(
      "invalid_redirect_uri",
      `redirect_uri non ammessi: ${nonAmmessi.join(", ")}. ` +
        `Il connettore accetta solo ${REDIRECT_URI_AMMESSI.join(" e ")}.`,
    )
  }

  const clientName =
    typeof corpo.client_name === "string" ? corpo.client_name.trim().slice(0, 120) : null

  const client = await registraClient({ clientName, redirectUris })
  console.log(
    `[mcp-oauth] client registrato: ${client.client_id} (${clientName ?? "senza nome"})`,
  )

  // 201 con l'eco dei metadati accettati, come chiede la RFC: il client deve
  // poter vedere cosa e' stato davvero registrato, non cosa aveva chiesto.
  return rispostaJson(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE_MCP,
    },
    201,
  )
}

export async function OPTIONS() {
  return rispostaPreflight()
}
