import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { TTL_CODICE_MS, TTL_REFRESH_TOKEN_MS } from "@/lib/mcp/oauth/config"
import { ErroreTokenMcp, hash, segretoCasuale } from "@/lib/mcp/oauth/cripto"

/**
 * Persistenza dell'OAuth del server MCP: client registrati, authorization code
 * e refresh token.
 *
 * Tutto passa dal service_role, e non e' una scorciatoia: le tre tabelle hanno
 * RLS attiva e zero policy, quindi da PostgREST non esistono per nessun ruolo.
 * Chi si autentica non ha ancora un JWT — per definizione — quindi qui non c'e'
 * una sessione utente da usare al suo posto.
 *
 * Nessun segreto e' salvato in chiaro: in tabella finisce sempre l'hash.
 */

function admin() {
  const client = createAdminClient()
  if (!client) {
    throw new ErroreTokenMcp("Supabase admin non configurato: OAuth del server MCP indisponibile")
  }
  return client
}

// ---------------------------------------------------------------------------
// Client (RFC 7591)

export type ClientRegistrato = {
  client_id: string
  client_name: string | null
  redirect_uris: string[]
  token_endpoint_auth_method: string
}

export async function registraClient(input: {
  clientName: string | null
  redirectUris: string[]
}): Promise<ClientRegistrato> {
  const clientId = `mcp_${segretoCasuale()}`
  const { data, error } = await admin()
    .from("mcp_oauth_clients")
    .insert({
      client_id: clientId,
      client_name: input.clientName,
      redirect_uris: input.redirectUris,
    })
    .select("client_id, client_name, redirect_uris, token_endpoint_auth_method")
    .single()

  if (error) throw new ErroreTokenMcp(`Registrazione client fallita: ${error.message}`)
  return data as ClientRegistrato
}

export async function leggiClient(clientId: string): Promise<ClientRegistrato | null> {
  const { data, error } = await admin()
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, token_endpoint_auth_method")
    .eq("client_id", clientId)
    .maybeSingle()

  if (error) throw new ErroreTokenMcp(`Lettura client fallita: ${error.message}`)
  return (data as ClientRegistrato | null) ?? null
}

export async function segnaUsoClient(clientId: string): Promise<void> {
  await admin()
    .from("mcp_oauth_clients")
    .update({ ultimo_uso_at: new Date().toISOString() })
    .eq("client_id", clientId)
}

// ---------------------------------------------------------------------------
// Authorization code

export type CodiceAutorizzazione = {
  id: string
  client_id: string
  redirect_uri: string
  code_challenge: string
  code_challenge_method: string
  resource: string | null
  scope: string | null
  utente_id: string
  auth_user_id: string
  ruolo: string
  scade_at: string
}

export async function creaCodice(input: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  resource: string | null
  scope: string | null
  utenteId: string
  authUserId: string
  ruolo: string
}): Promise<string> {
  const codice = segretoCasuale()
  const { error } = await admin()
    .from("mcp_oauth_codes")
    .insert({
      code_hash: hash(codice),
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      code_challenge_method: input.codeChallengeMethod,
      resource: input.resource,
      scope: input.scope,
      utente_id: input.utenteId,
      auth_user_id: input.authUserId,
      ruolo: input.ruolo,
      scade_at: new Date(Date.now() + TTL_CODICE_MS).toISOString(),
    })

  if (error) throw new ErroreTokenMcp(`Creazione codice fallita: ${error.message}`)
  return codice
}

/**
 * Consuma il codice: lo marca usato e lo restituisce, una volta sola.
 *
 * L'unicita' d'uso e' garantita dal database, non dal codice applicativo: la
 * UPDATE condizionata `where usato_at is null` e' atomica sulla riga, quindi
 * due scambi in parallelo dello stesso codice non possono riuscire entrambi.
 *
 * Un codice gia' speso che ritorna e' un segnale, non un incidente: la
 * specifica OAuth chiede di revocare i token nati da quel codice, perche' o e'
 * un replay o qualcuno ha intercettato il redirect. Qui si revoca l'intera
 * famiglia di refresh token di quell'utente su quel client.
 */
export async function consumaCodice(codice: string): Promise<CodiceAutorizzazione | null> {
  const codeHash = hash(codice)
  const adesso = new Date().toISOString()

  const { data, error } = await admin()
    .from("mcp_oauth_codes")
    .update({ usato_at: adesso })
    .eq("code_hash", codeHash)
    .is("usato_at", null)
    .select("*")
    .maybeSingle()

  if (error) throw new ErroreTokenMcp(`Scambio codice fallito: ${error.message}`)

  if (!data) {
    // Nessuna riga rivendicata: o il codice non esiste, o era gia' stato speso.
    const { data: gia } = await admin()
      .from("mcp_oauth_codes")
      .select("utente_id, client_id")
      .eq("code_hash", codeHash)
      .maybeSingle()
    if (gia) {
      const riga = gia as { utente_id: string; client_id: string }
      console.warn("[mcp-oauth] codice riutilizzato: revoca dei refresh token collegati")
      await revocaRefreshPerUtente(riga.utente_id, riga.client_id)
    }
    return null
  }

  const riga = data as CodiceAutorizzazione & { usato_at: string }
  if (new Date(riga.scade_at).getTime() <= Date.now()) return null
  return riga
}

// ---------------------------------------------------------------------------
// Refresh token

export type RigaRefresh = {
  id: string
  client_id: string
  utente_id: string
  auth_user_id: string
  scade_at: string
}

export async function creaRefreshToken(input: {
  clientId: string
  utenteId: string
  authUserId: string
}): Promise<string> {
  const token = segretoCasuale()
  const { error } = await admin()
    .from("mcp_refresh_tokens")
    .insert({
      token_hash: hash(token),
      client_id: input.clientId,
      utente_id: input.utenteId,
      auth_user_id: input.authUserId,
      scade_at: new Date(Date.now() + TTL_REFRESH_TOKEN_MS).toISOString(),
    })

  if (error) throw new ErroreTokenMcp(`Creazione refresh token fallita: ${error.message}`)
  return token
}

/**
 * Rivendica un refresh token e ne conia il successore (rotazione).
 *
 * Il vecchio viene revocato nello stesso momento in cui viene accettato: un
 * refresh token vale una volta. Se ne ritorna uno gia' revocato — un replay, o
 * un token rubato usato dopo quello legittimo — si stacca tutta la famiglia,
 * cosi' l'accesso muore anche per chi lo ha rubato.
 */
export async function ruotaRefreshToken(
  token: string,
): Promise<{ riga: RigaRefresh; nuovoToken: string } | null> {
  const tokenHash = hash(token)
  const adesso = new Date().toISOString()

  const { data, error } = await admin()
    .from("mcp_refresh_tokens")
    .update({ revoked_at: adesso, ultimo_uso_at: adesso })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("scade_at", adesso)
    .select("id, client_id, utente_id, auth_user_id, scade_at")
    .maybeSingle()

  if (error) throw new ErroreTokenMcp(`Rotazione refresh token fallita: ${error.message}`)

  if (!data) {
    const { data: gia } = await admin()
      .from("mcp_refresh_tokens")
      .select("utente_id, client_id, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle()
    const riga = gia as { utente_id: string; client_id: string; revoked_at: string | null } | null
    if (riga?.revoked_at) {
      console.warn("[mcp-oauth] refresh token riutilizzato: revoca della famiglia")
      await revocaRefreshPerUtente(riga.utente_id, riga.client_id)
    }
    return null
  }

  const riga = data as RigaRefresh
  const nuovoToken = await creaRefreshToken({
    clientId: riga.client_id,
    utenteId: riga.utente_id,
    authUserId: riga.auth_user_id,
  })

  // Traccia della catena: serve a leggere la storia di una sessione, non al
  // funzionamento. Se fallisce non si annulla la rotazione gia' avvenuta.
  const { data: nuovo } = await admin()
    .from("mcp_refresh_tokens")
    .select("id")
    .eq("token_hash", hash(nuovoToken))
    .maybeSingle()
  if (nuovo) {
    await admin()
      .from("mcp_refresh_tokens")
      .update({ sostituito_da: (nuovo as { id: string }).id })
      .eq("id", riga.id)
  }

  return { riga, nuovoToken }
}

/** Revoca puntuale (RFC 7009): il token presentato, se esiste ed e' attivo. */
export async function revocaRefreshToken(token: string): Promise<void> {
  await admin()
    .from("mcp_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .is("revoked_at", null)
}

/**
 * Stacca un utente: tutti i suoi refresh token attivi, opzionalmente solo su
 * un client. E' la leva da usare quando una persona cambia ruolo o lascia
 * l'azienda, senza aspettare i 30 giorni di scadenza naturale.
 */
export async function revocaRefreshPerUtente(
  utenteId: string,
  clientId?: string,
): Promise<number> {
  let query = admin()
    .from("mcp_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("utente_id", utenteId)
    .is("revoked_at", null)
  if (clientId) query = query.eq("client_id", clientId)

  const { data, error } = await query.select("id")
  if (error) throw new ErroreTokenMcp(`Revoca fallita: ${error.message}`)
  return (data as { id: string }[] | null)?.length ?? 0
}

// ---------------------------------------------------------------------------
// Manutenzione

/**
 * Toglie di mezzo i codici scaduti. Gira in sottofondo dopo uno scambio
 * riuscito: sono righe effimere, e senza pulizia la tabella crescerebbe con
 * segreti (per quanto hashati) che non servono piu' a nessuno.
 */
export async function pulisciCodiciScaduti(): Promise<void> {
  const soglia = new Date(Date.now() - TTL_CODICE_MS * 10).toISOString()
  const { error } = await admin().from("mcp_oauth_codes").delete().lt("scade_at", soglia)
  if (error) console.error("[mcp-oauth] pulizia codici fallita:", error.message)
}
