import { NextResponse, after } from "next/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { eseguiNelContestoMcp } from "@/lib/mcp/context"
import { PERCORSO_METADATA_PR, origineRichiesta } from "@/lib/mcp/oauth/config"
import { autenticaRichiestaMcp, type EsitoAutenticazione } from "@/lib/mcp/oauth/identita"
import { creaServerMcp } from "@/lib/mcp/server"
import { creaClientMcp } from "@/lib/mcp/supabase"

/**
 * Endpoint del server MCP (Streamable HTTP), esposto a Claude come custom
 * connector.
 *
 * Autenticazione in due passaggi distinti:
 *  1. Claude -> qui: access token OAuth firmato da noi, che dice QUALE utente
 *     sta chiamando (oppure il vecchio bearer statico, tenuto vivo per il
 *     connettore gia' configurato). Verificato PRIMA di leggere il corpo della
 *     richiesta: senza token valido non si arriva mai al protocollo.
 *  2. qui -> Supabase: JWT dell'utente reale, coniato in service_role ma usato
 *     come una sessione qualunque, cosi' la RLS resta in mezzo.
 *
 * Fra i due passaggi c'e' il controllo che rende revocabile l'accesso: utente
 * esistente, attivo, e con ruolo fra SUPERADMIN/ADMIN/DIRECTOR *adesso*, non
 * al momento del login. Chi viene disattivato o retrocesso perde l'accesso
 * alla richiesta successiva, senza aspettare la scadenza del token.
 *
 * La rotta e' fra i publicRoutes del middleware: il gate di sessione del CRM
 * cerca un cookie che un client MCP non ha e non puo' avere. Si difende da
 * sola, come /api/public/* e /api/cron.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Risposta di rifiuto in forma standard.
 *
 * `WWW-Authenticate` con `resource_metadata` non e' decorazione: e' il modo
 * previsto da RFC 9728 perche' un client MCP scopra dove autenticarsi, ed e'
 * la strada che rimette in carreggiata claude.ai quando decide da solo di
 * fare OAuth (anthropics/claude-ai-mcp#644). Senza questo header il client
 * tira a indovinare sull'origine.
 */
function rifiuta(request: Request, esito: Extract<EsitoAutenticazione, { ok: false }>) {
  const risorsaMetadata = `${origineRichiesta(request)}${PERCORSO_METADATA_PR}`
  const parametri =
    esito.stato === 401
      ? `error="invalid_token", error_description="${esito.descrizione.replace(/"/g, "'")}"`
      : `error="insufficient_scope", error_description="${esito.descrizione.replace(/"/g, "'")}"`

  console.warn(`[mcp] accesso negato (${esito.stato} ${esito.codice}): ${esito.descrizione}`)

  return NextResponse.json(
    { error: esito.codice, error_description: esito.descrizione },
    {
      status: esito.stato,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${risorsaMetadata}", ${parametri}`,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
        "Cache-Control": "no-store",
      },
    },
  )
}

export async function POST(request: Request) {
  const esito = await autenticaRichiestaMcp(request)
  if (!esito.ok) return rifiuta(request, esito)
  const identita = esito.identita

  const server = creaServerMcp()
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: nessuna sessione da tenere viva fra due invocazioni
    // serverless, che possono cadere su istanze diverse.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    const client = await creaClientMcp(identita.authUserId)
    // Il contesto avvolge l'intera gestione della richiesta: i tool girano
    // dentro handleRequest, quindi e' li' che i repository devono trovare il
    // client di QUESTO utente al posto di quello a cookie — e li' che il
    // registro trova a chi attribuire la chiamata.
    const risposta = await eseguiNelContestoMcp(client, identita, () =>
      transport.handleRequest(request),
    )
    after(() => {
      void server.close().catch(() => {})
    })
    return risposta
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Errore sconosciuto"
    console.error("[mcp] richiesta fallita:", messaggio)
    void server.close().catch(() => {})
    // Errore di trasporto o di conio del token: il protocollo non e' nemmeno
    // partito, quindi si risponde in HTTP e non in JSON-RPC.
    return NextResponse.json({ error: "Errore interno del server MCP" }, { status: 500 })
  }
}

/**
 * In modalita' stateless non c'e' uno stream server -> client da riaprire ne'
 * una sessione da chiudere: la specifica Streamable HTTP prevede 405.
 *
 * Il 401 pero' viene prima: una GET senza token e' spesso il primo colpo che
 * un client MCP tira per scoprire come autenticarsi, e rispondergli "metodo
 * non consentito" lo lascerebbe senza l'indicazione dei metadata.
 */
export async function GET(request: Request) {
  const esito = await autenticaRichiestaMcp(request)
  if (!esito.ok) return rifiuta(request, esito)

  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  )
}

export async function DELETE(request: Request) {
  const esito = await autenticaRichiestaMcp(request)
  if (!esito.ok) return rifiuta(request, esito)

  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  )
}
