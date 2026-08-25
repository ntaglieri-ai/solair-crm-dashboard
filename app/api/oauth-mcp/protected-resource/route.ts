import { SCOPE_MCP, origineRichiesta, risorsaMcp } from "@/lib/mcp/oauth/config"
import { rispostaJson, rispostaPreflight } from "@/lib/mcp/oauth/risposte"

/**
 * Protected Resource Metadata (RFC 9728): dice al client quale server di
 * autorizzazione protegge /api/mcp.
 *
 * Claude la cerca sia in fondo al percorso della risorsa
 * (/.well-known/oauth-protected-resource/api/mcp) sia sulla radice: le
 * riscritture in next.config.mjs mappano entrambe qui, perche' quale delle due
 * venga provata per prima dipende dal client e dalla piattaforma.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const origine = origineRichiesta(request)

  return rispostaJson({
    resource: risorsaMcp(origine),
    authorization_servers: [origine],
    scopes_supported: [SCOPE_MCP],
    bearer_methods_supported: ["header"],
    resource_name: "Solair CRM — server MCP",
  })
}

export async function OPTIONS() {
  return rispostaPreflight()
}
