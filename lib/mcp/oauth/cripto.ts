import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/**
 * Primitive crittografiche dell'OAuth del server MCP: firma dei token, hash
 * dei segreti a riposo, verifica PKCE.
 *
 * Scritte a mano invece di aggiungere una libreria JWT: serve un solo
 * algoritmo (HS256, chiave simmetrica nostra, emittente e verificatore sono lo
 * stesso processo), e una dipendenza in piu' per ~40 righe di HMAC sarebbe
 * superficie di attacco senza contropartita. Niente `server-only` qui dentro:
 * il modulo e' puro e i test unitari lo caricano.
 */

export class ErroreTokenMcp extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ErroreTokenMcp"
  }
}

// ---------------------------------------------------------------------------
// Segreti

/** Segreto opaco da consegnare al client (code, refresh token). 256 bit. */
export function segretoCasuale(): string {
  return randomBytes(32).toString("base64url")
}

/**
 * I segreti non si salvano in chiaro: in tabella finisce l'hash, cosi' chi
 * legge il registro non puo' spendere il token. Nessun salt e nessun KDF
 * lento: l'input e' gia' 256 bit di entropia, un attacco a dizionario non ha
 * dizionario da provare.
 */
export function hash(valore: string): string {
  return createHash("sha256").update(valore).digest("hex")
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

// ---------------------------------------------------------------------------
// PKCE (RFC 7636), solo S256

/** Il verifier ammesso dalla specifica: 43-128 caratteri dell'alfabeto unreserved. */
const VERIFIER_VALIDO = /^[A-Za-z0-9\-._~]{43,128}$/

export function sfidaDaVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

/**
 * Vero se il `code_verifier` presentato a /token corrisponde al
 * `code_challenge` depositato a /authorize.
 *
 * `plain` non e' supportato di proposito: OAuth 2.1 lo scoraggia e Claude
 * annuncia S256. Un metodo diverso e' un errore, non un caso da gestire.
 */
export function verificaPkce(verifier: string, sfida: string, metodo = "S256"): boolean {
  if (metodo !== "S256") return false
  if (!VERIFIER_VALIDO.test(verifier)) return false
  return confrontoCostante(sfidaDaVerifier(verifier), sfida)
}

// ---------------------------------------------------------------------------
// JWT HS256

export type PayloadAccessToken = {
  /** Emittente: l'origine che ha coniato il token. */
  iss: string
  /** L'utente CRM: `utenti.id`, non l'id di auth. */
  sub: string
  /** La risorsa per cui il token vale: <origine>/api/mcp. */
  aud: string
  exp: number
  iat: number
  jti: string
  /** Marcatore di tipo: impedisce di spendere altrove un token coniato qui. */
  typ: "mcp-access"
  ruolo: string
  auth_user_id: string
  client_id: string
  scope?: string
}

function base64url(valore: string): string {
  return Buffer.from(valore, "utf8").toString("base64url")
}

function base64urlJson(valore: unknown): string {
  return Buffer.from(JSON.stringify(valore), "utf8").toString("base64url")
}

/** Firma un payload qualsiasi in formato JWS compatto (HS256). */
export function firmaJws(payload: Record<string, unknown>, chiave: string): string {
  const intestazione = base64urlJson({ alg: "HS256", typ: "JWT" })
  const corpo = base64urlJson(payload)
  const firma = createHmac("sha256", chiave).update(`${intestazione}.${corpo}`).digest("base64url")
  return `${intestazione}.${corpo}.${firma}`
}

/**
 * Verifica firma, algoritmo e scadenza di un JWS compatto e restituisce il
 * payload grezzo. Cosa contenga quel payload lo decide il chiamante.
 */
export function verificaJws(token: string, chiave: string): Record<string, unknown> {
  const parti = token.split(".")
  if (parti.length !== 3) throw new ErroreTokenMcp("Token malformato")

  const [intestazione, corpo, firma] = parti
  const atteso = createHmac("sha256", chiave).update(`${intestazione}.${corpo}`).digest("base64url")
  if (!confrontoCostante(firma, atteso)) throw new ErroreTokenMcp("Firma del token non valida")

  let payload: Record<string, unknown>
  try {
    const testa = JSON.parse(Buffer.from(intestazione, "base64url").toString("utf8")) as {
      alg?: string
    }
    // `alg: none` e le sostituzioni di algoritmo si fermano qui: l'unico
    // valore accettato e' quello con cui firmiamo.
    if (testa.alg !== "HS256") throw new ErroreTokenMcp("Algoritmo del token non ammesso")
    payload = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Record<string, unknown>
  } catch (errore) {
    if (errore instanceof ErroreTokenMcp) throw errore
    throw new ErroreTokenMcp("Contenuto del token illeggibile")
  }

  const exp = payload.exp
  if (typeof exp !== "number" || exp * 1000 <= Date.now()) {
    throw new ErroreTokenMcp("Token scaduto")
  }
  return payload
}

export function firmaAccessToken(payload: PayloadAccessToken, chiave: string): string {
  return firmaJws(payload as unknown as Record<string, unknown>, chiave)
}

/**
 * Access token del server MCP.
 *
 * `iss` e `aud` NON vengono confrontati con l'host della richiesta: la stessa
 * applicazione risponde su crm.solairgroup.it, sugli alias *.vercel.app e su
 * localhost, e un confronto stretto renderebbe il connettore rotto in modo
 * apparentemente casuale a seconda del dominio da cui arriva la chiamata. A
 * separare i token ci pensano la chiave di firma (una sola, nostra) e il campo
 * `typ`; il perimetro di cosa quel token puo' fare e' deciso dai controlli su
 * utente e ruolo, che girano comunque a ogni richiesta.
 */
export function verificaAccessToken(token: string, chiave: string): PayloadAccessToken {
  const payload = verificaJws(token, chiave) as unknown as PayloadAccessToken
  if (payload.typ !== "mcp-access") throw new ErroreTokenMcp("Token non destinato al server MCP")
  if (!payload.sub || !payload.auth_user_id) throw new ErroreTokenMcp("Token privo di identita'")
  return payload
}

/** La chiave di firma, con un errore leggibile se manca in ambiente. */
export function chiaveDiFirma(): string {
  const chiave = process.env.MCP_OAUTH_SIGNING_KEY
  if (!chiave || chiave.length < 32) {
    throw new ErroreTokenMcp(
      "MCP_OAUTH_SIGNING_KEY non configurata (o troppo corta): OAuth del server MCP disattivato",
    )
  }
  return chiave
}
