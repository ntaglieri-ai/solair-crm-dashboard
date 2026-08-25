import {
  PERCORSO_AUTORIZZAZIONE,
  PERCORSO_REGISTRAZIONE,
  PERCORSO_REVOCA,
  PERCORSO_TOKEN,
  SCOPE_MCP,
  origineRichiesta,
} from "@/lib/mcp/oauth/config"
import { rispostaJson, rispostaPreflight } from "@/lib/mcp/oauth/risposte"

/**
 * Authorization Server Metadata (RFC 8414), servita su
 * /.well-known/oauth-authorization-server tramite le riscritture in
 * next.config.mjs.
 *
 * E' il documento che risolve il difetto noto del connettore claude.ai
 * (anthropics/claude-ai-mcp#644): quando il client decide di fare OAuth invece
 * di usare l'header statico, cerca gli endpoint qui. Finche' questo documento
 * non esisteva, tirava a indovinare `/authorize` sull'origine e prendeva 404.
 *
 * `registration_endpoint` deve essere una stringa e non null: alcuni client
 * validano lo schema e falliscono su null anche quando un client_id ce l'hanno
 * gia'.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const origine = origineRichiesta(request)

  return rispostaJson({
    issuer: origine,
    authorization_endpoint: `${origine}${PERCORSO_AUTORIZZAZIONE}`,
    token_endpoint: `${origine}${PERCORSO_TOKEN}`,
    registration_endpoint: `${origine}${PERCORSO_REGISTRAZIONE}`,
    revocation_endpoint: `${origine}${PERCORSO_REVOCA}`,
    scopes_supported: [SCOPE_MCP],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // Client pubblici: il segreto non aggiungerebbe nulla a PKCE, e un
    // segreto che vive dentro un client che non puo' custodirlo e' una
    // sicurezza solo apparente.
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    resource_indicators_supported: true,
  })
}

export async function OPTIONS() {
  return rispostaPreflight()
}
