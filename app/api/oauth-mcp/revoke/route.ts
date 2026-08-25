import { revocaRefreshToken } from "@/lib/mcp/oauth/archivio"
import { erroreOAuth, ipChiamante, rispostaJson, rispostaPreflight } from "@/lib/mcp/oauth/risposte"
import { rateLimit, sweepExpired } from "@/lib/rate-limit"

/**
 * Revoca di un refresh token (RFC 7009).
 *
 * La specifica impone 200 anche quando il token non esiste: rispondere in modo
 * diverso trasformerebbe l'endpoint in un modo per sapere se un token e'
 * valido. Gli access token gia' emessi non si revocano qui — vivono un'ora e
 * comunque non passano i controlli su utente e ruolo se qualcosa e' cambiato.
 *
 * Per staccare una persona in blocco si usa revocaRefreshPerUtente() dal
 * server, non questo endpoint.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  sweepExpired()
  const { allowed } = rateLimit(`mcp-oauth-revoke:${ipChiamante(request)}`, 60, 10 * 60 * 1000)
  if (!allowed) return erroreOAuth("too_many_requests", "Troppe richieste.", 429)

  const tipo = request.headers.get("content-type") ?? ""
  let token: string | null = null
  try {
    if (tipo.includes("application/json")) {
      const corpo = (await request.json()) as { token?: unknown }
      token = typeof corpo.token === "string" ? corpo.token : null
    } else {
      token = new URLSearchParams(await request.text()).get("token")
    }
  } catch {
    token = null
  }

  if (token) await revocaRefreshToken(token)
  return rispostaJson({})
}

export async function OPTIONS() {
  return rispostaPreflight()
}
