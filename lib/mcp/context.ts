// Niente `import "server-only"` qui, a differenza degli altri moduli di
// lib/mcp: questo file finisce nella catena di import di lib/supabase/server.ts,
// che i test unitari caricano: il marcatore non e' risolvibile fuori dal bundle
// di Next e farebbe fallire suite che non c'entrano nulla. La protezione resta
// comunque, per costruzione: node:async_hooks non esiste nel browser.
import { AsyncLocalStorage } from "node:async_hooks"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * I repository del CRM (lib/leads, lib/clienti, lib/compiti, lib/scadenze,
 * lib/installatori) chiamano tutti `createClient()` di lib/supabase/server.ts,
 * che legge i cookie di sessione. In /api/mcp di cookie non ce ne sono.
 *
 * Invece di aggiungere un parametro client a una trentina di funzioni gia'
 * scritte e collaudate — cambiando la firma di tutto il livello dati per un
 * solo chiamante nuovo — il client di Vito viaggia in un AsyncLocalStorage.
 * `createClient()` lo consulta: se il contesto MCP e' attivo restituisce
 * quello, altrimenti si comporta esattamente come prima.
 *
 * Il contesto si apre solo dentro l'handler di /api/mcp e vive quanto la
 * singola richiesta: nessuna richiesta dell'app puo' trovarselo attivo.
 */

type ContestoMcp = { client: SupabaseClient }

const contesto = new AsyncLocalStorage<ContestoMcp>()

/** Esegue `fn` con il client MCP visibile a tutto lo stack sottostante. */
export function eseguiNelContestoMcp<T>(client: SupabaseClient, fn: () => Promise<T>): Promise<T> {
  return contesto.run({ client }, fn)
}

/** Il client MCP se siamo dentro una richiesta /api/mcp, altrimenti null. */
export function clientMcpDalContesto(): SupabaseClient | null {
  return contesto.getStore()?.client ?? null
}

/** Come sopra, ma per il codice che senza client non puo' proseguire. */
export function clientMcpObbligatorio(): SupabaseClient {
  const client = clientMcpDalContesto()
  if (!client) {
    throw new Error("Contesto MCP non attivo: nessun client Supabase disponibile")
  }
  return client
}
