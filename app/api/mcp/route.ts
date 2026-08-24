import { timingSafeEqual } from "node:crypto"

import { NextResponse, after } from "next/server"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { eseguiNelContestoMcp } from "@/lib/mcp/context"
import { creaServerMcp } from "@/lib/mcp/server"
import { creaClientMcp } from "@/lib/mcp/supabase"

/**
 * Endpoint del server MCP (Streamable HTTP), esposto a Claude come custom
 * connector.
 *
 * Autenticazione in due passaggi distinti:
 *  1. Claude -> qui: bearer statico MCP_ACCESS_TOKEN, confrontato in tempo
 *     costante PRIMA di leggere il corpo della richiesta. Nessun token, nessun
 *     parsing: una richiesta non autenticata non arriva mai al protocollo.
 *  2. qui -> Supabase: JWT dell'utente reale, coniato in service_role ma usato
 *     come una sessione qualunque, cosi' la RLS resta in mezzo.
 *
 * La rotta e' fra i publicRoutes del middleware: il gate di sessione del CRM
 * cerca un cookie che un client MCP non ha e non puo' avere. Si difende da
 * sola, come /api/public/* e /api/cron.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function confrontoCostante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  // timingSafeEqual pretende la stessa lunghezza: il confronto va fatto
  // comunque, altrimenti la lunghezza del token trapelerebbe dal tempo.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA)
    return false
  }
  return timingSafeEqual(bufferA, bufferB)
}

function verificaBearer(request: Request): NextResponse | null {
  const atteso = process.env.MCP_ACCESS_TOKEN
  if (!atteso) {
    console.error("[mcp] MCP_ACCESS_TOKEN non configurata: endpoint disattivato")
    return NextResponse.json({ error: "Server MCP non configurato" }, { status: 503 })
  }
  const fornito = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!fornito || !confrontoCostante(fornito, atteso)) {
    console.warn("[mcp] richiesta senza token valido")
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }
  return null
}

export async function POST(request: Request) {
  const negato = verificaBearer(request)
  if (negato) return negato

  const server = creaServerMcp()
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: nessuna sessione da tenere viva fra due invocazioni
    // serverless, che possono cadere su istanze diverse.
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    const client = await creaClientMcp()
    // Il contesto avvolge l'intera gestione della richiesta: i tool girano
    // dentro handleRequest, quindi e' li' che i repository devono trovare il
    // client di Vito al posto di quello a cookie.
    const risposta = await eseguiNelContestoMcp(client, () => transport.handleRequest(request))
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

// In modalita' stateless non c'e' uno stream server -> client da riaprire ne'
// una sessione da chiudere: la specifica Streamable HTTP prevede 405.
export async function GET() {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  )
}

export async function DELETE() {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  )
}
