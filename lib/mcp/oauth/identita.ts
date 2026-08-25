import "server-only"

import { timingSafeEqual } from "node:crypto"

import type { IdentitaContestoMcp } from "@/lib/mcp/context"
import { createAdminClient } from "@/lib/supabase/admin"
import { MOTIVO_RUOLO_NON_AMMESSO, ruoloAmmesso } from "@/lib/mcp/oauth/config"
import { chiaveDiFirma, verificaAccessToken } from "@/lib/mcp/oauth/cripto"

/**
 * Chi sta chiamando il server MCP, e se ha ancora il diritto di farlo.
 *
 * Il punto di questo modulo e' che i controlli si rifanno a OGNI richiesta,
 * non solo al login: il token dice chi sei, ma "esisti, sei attivo e il tuo
 * ruolo e' fra quelli ammessi" viene riletto dal database ogni volta. Se un
 * account viene disattivato o retrocesso, il token gia' emesso smette di
 * funzionare alla chiamata successiva, senza aspettare la scadenza.
 *
 * Il costo e' una SELECT su `utenti` per richiesta MCP — trascurabile rispetto
 * al lavoro che fa un tool, e l'unico modo di rendere vera la revoca.
 */

/**
 * Alias, non una copia: e' esattamente cio' che viaggia nel contesto della
 * richiesta MCP. Ridefinirlo qui vorrebbe dire due tipi identici oggi e
 * divergenti al primo campo aggiunto.
 */
export type IdentitaMcp = IdentitaContestoMcp

export type EsitoAutenticazione =
  | { ok: true; identita: IdentitaMcp }
  | { ok: false; stato: 401 | 403 | 503; codice: string; descrizione: string }

type RigaUtente = {
  id: string
  nome: string | null
  email: string | null
  ruolo: string | null
  attivo: boolean | null
  auth_user_id: string | null
  must_change_password: boolean | null
}

const COLONNE = "id, nome, email, ruolo, attivo, auth_user_id, must_change_password"

function admin() {
  const client = createAdminClient()
  if (!client) throw new Error("Supabase admin non configurato")
  return client
}

/**
 * Trasforma una riga di `utenti` in un'identita' utilizzabile, oppure spiega
 * perche' no. I motivi restano generici verso l'esterno: un client MCP non
 * deve poter distinguere "non esisti" da "sei stato disattivato".
 */
function valuta(riga: RigaUtente | null): EsitoAutenticazione {
  if (!riga) {
    return { ok: false, stato: 403, codice: "utente_inesistente", descrizione: "Utente non trovato." }
  }
  if (riga.attivo !== true) {
    return {
      ok: false,
      stato: 403,
      codice: "utente_disattivato",
      descrizione: "Account disattivato: accesso al server MCP negato.",
    }
  }
  if (!ruoloAmmesso(riga.ruolo)) {
    return { ok: false, stato: 403, codice: "ruolo_non_ammesso", descrizione: MOTIVO_RUOLO_NON_AMMESSO }
  }
  if (!riga.auth_user_id) {
    return {
      ok: false,
      stato: 403,
      codice: "senza_account_auth",
      descrizione: "L'utente non ha un account di autenticazione collegato.",
    }
  }
  return {
    ok: true,
    identita: {
      utenteId: riga.id,
      authUserId: riga.auth_user_id,
      ruolo: (riga.ruolo ?? "").trim().toUpperCase(),
      nome: riga.nome ?? "",
      email: riga.email ?? "",
    },
  }
}

/** Controlli su un utente identificato da `utenti.id` (il `sub` del token). */
export async function verificaUtenteId(utenteId: string): Promise<EsitoAutenticazione> {
  const { data, error } = await admin().from("utenti").select(COLONNE).eq("id", utenteId).maybeSingle()
  if (error) throw new Error(`Lettura utente fallita: ${error.message}`)
  return valuta(data as RigaUtente | null)
}

/** Come sopra, partendo dall'id di Supabase Auth (sessione browser, VITO_USER_ID). */
export async function verificaAuthUserId(authUserId: string): Promise<EsitoAutenticazione> {
  const { data, error } = await admin()
    .from("utenti")
    .select(COLONNE)
    .eq("auth_user_id", authUserId)
    .maybeSingle()
  if (error) throw new Error(`Lettura utente fallita: ${error.message}`)
  return valuta(data as RigaUtente | null)
}

/** Vero se l'utente deve ancora sostituire la password temporanea. */
export async function deveCambiarePassword(authUserId: string): Promise<boolean> {
  const { data } = await admin()
    .from("utenti")
    .select("must_change_password")
    .eq("auth_user_id", authUserId)
    .maybeSingle()
  return (data as { must_change_password: boolean | null } | null)?.must_change_password === true
}

function confrontoCostante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA)
    return false
  }
  return timingSafeEqual(bufferA, bufferB)
}

function bearerDaRichiesta(request: Request): string | null {
  const intestazione = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(intestazione.trim())
  return match ? match[1].trim() : null
}

/**
 * Autentica una richiesta a /api/mcp.
 *
 * Due strade, in quest'ordine:
 *  1. bearer statico MCP_ACCESS_TOKEN -> l'utente di VITO_USER_ID. E' il
 *     percorso storico, tenuto vivo per non staccare il connettore gia'
 *     configurato mentre si passa a OAuth. Non salta nessun controllo: ruolo e
 *     stato dell'account vengono verificati anche qui.
 *  2. access token OAuth firmato da noi -> l'utente scritto nel `sub`.
 *
 * Qualunque fallimento, in qualunque punto, si ferma qui: nessuna richiesta
 * senza identita' valida arriva ai tool.
 */
export async function autenticaRichiestaMcp(request: Request): Promise<EsitoAutenticazione> {
  const bearer = bearerDaRichiesta(request)
  if (!bearer) {
    return { ok: false, stato: 401, codice: "invalid_token", descrizione: "Token di accesso mancante." }
  }

  const statico = process.env.MCP_ACCESS_TOKEN
  const vitoUserId = process.env.VITO_USER_ID
  if (statico && vitoUserId && confrontoCostante(bearer, statico)) {
    return verificaAuthUserId(vitoUserId)
  }

  let payload
  try {
    payload = verificaAccessToken(bearer, chiaveDiFirma())
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Token non valido"
    // Chiave assente: e' un guasto di configurazione nostro, non un token
    // sbagliato del client. Va detto in modo diverso, altrimenti si passano
    // ore a cercare un problema di credenziali che non c'e'.
    if (messaggio.includes("MCP_OAUTH_SIGNING_KEY")) {
      return { ok: false, stato: 503, codice: "server_error", descrizione: messaggio }
    }
    return { ok: false, stato: 401, codice: "invalid_token", descrizione: messaggio }
  }

  const esito = await verificaUtenteId(payload.sub)
  if (!esito.ok) return esito

  // Il ruolo scritto nel token e' una fotografia del momento del login: se nel
  // frattempo e' cambiato vale quello del database, gia' validato sopra.
  if (esito.identita.ruolo !== payload.ruolo) {
    console.warn(
      `[mcp-oauth] ruolo cambiato dopo l'emissione del token: ${payload.ruolo} -> ${esito.identita.ruolo}`,
    )
  }
  return esito
}
