import { NextResponse } from "next/server"

/**
 * Forma delle risposte degli endpoint OAuth.
 *
 * Due dettagli che non sono cosmetici:
 *  - `Cache-Control: no-store` e' obbligatorio su token e metadata (RFC 6749
 *    §5.1): una risposta con un access token dentro non deve finire in nessuna
 *    cache intermedia;
 *  - CORS aperto. Gli endpoint OAuth sono pubblici per definizione (chiunque
 *    puo' leggere i metadata, e chi arriva a /token deve gia' avere un codice
 *    valido e il suo verifier), e i client MCP che girano nel browser li
 *    interrogano cross-origin: senza questi header il collegamento fallisce
 *    con un errore di rete che non dice nulla.
 */

export const INTESTAZIONI_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
}

export function rispostaJson(corpo: unknown, stato = 200): NextResponse {
  return NextResponse.json(corpo, {
    status: stato,
    headers: { ...INTESTAZIONI_CORS, "Cache-Control": "no-store", Pragma: "no-cache" },
  })
}

export function rispostaPreflight(): Response {
  return new Response(null, { status: 204, headers: INTESTAZIONI_CORS })
}

/** Errore nel formato di OAuth 2.0 (RFC 6749 §5.2), l'unico che i client sanno leggere. */
export function erroreOAuth(
  codice: string,
  descrizione: string,
  stato = 400,
): NextResponse {
  console.warn(`[mcp-oauth] ${codice}: ${descrizione}`)
  return rispostaJson({ error: codice, error_description: descrizione }, stato)
}

/**
 * IP del chiamante, per i limitatori di frequenza. Duplicato di poche righe
 * rispetto a `clientIp` di lib/audit/log.ts, e non un import: il modulo OAuth
 * non deve dipendere dal registro di audit, che sta fuori dal suo perimetro.
 */
export function ipChiamante(request: Request): string {
  const inoltrato = request.headers.get("x-forwarded-for")
  const primo = inoltrato?.split(",")[0]?.trim()
  return primo || request.headers.get("x-real-ip")?.trim() || "sconosciuto"
}
