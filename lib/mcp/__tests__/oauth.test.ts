import { describe, expect, it } from "vitest"

import {
  REDIRECT_URI_AMMESSI,
  RUOLI_AMMESSI,
  redirectUriAmmesso,
  ruoloAmmesso,
} from "@/lib/mcp/oauth/config"
import {
  ErroreTokenMcp,
  firmaAccessToken,
  firmaJws,
  hash,
  segretoCasuale,
  sfidaDaVerifier,
  verificaAccessToken,
  verificaPkce,
} from "@/lib/mcp/oauth/cripto"
import { analizzaParametri, firmaRichiesta, urlDiRitorno, verificaRichiesta } from "@/lib/mcp/oauth/richiesta"

/**
 * Test della parte pura dell'OAuth del server MCP: chi puo' entrare, dove si
 * puo' tornare, e le due primitive su cui si regge tutto il resto (PKCE e
 * firma dei token). Niente Supabase e niente rete: quello che sta qui deve
 * poter fallire in millisecondi, non in un ambiente di prova.
 */

const CHIAVE = "chiave-di-prova-lunga-abbastanza-per-passare-il-controllo"

describe("perimetro dei ruoli", () => {
  it("ammette solo SUPERADMIN, ADMIN e DIRECTOR", () => {
    expect([...RUOLI_AMMESSI]).toEqual(["SUPERADMIN", "ADMIN", "DIRECTOR"])
    for (const ruolo of RUOLI_AMMESSI) expect(ruoloAmmesso(ruolo)).toBe(true)
    for (const ruolo of ["AGENT", "STANDARD", "VIEWER", "", "superadmin "]) {
      expect(ruoloAmmesso(ruolo)).toBe(ruolo.trim().toUpperCase() === "SUPERADMIN")
    }
  })

  it("non ammette ruolo assente", () => {
    expect(ruoloAmmesso(null)).toBe(false)
    expect(ruoloAmmesso(undefined)).toBe(false)
  })
})

describe("whitelist dei redirect_uri", () => {
  it("accetta solo i due callback di Claude", () => {
    for (const uri of REDIRECT_URI_AMMESSI) expect(redirectUriAmmesso(uri)).toBe(true)
  })

  it("rifiuta i travestimenti che un confronto per prefisso lascerebbe passare", () => {
    const tentativi = [
      "https://claude.ai.attaccante.tld/api/mcp/auth_callback",
      "https://claude.ai/api/mcp/auth_callback/../../evil",
      "https://claude.ai@attaccante.tld/api/mcp/auth_callback",
      "http://claude.ai/api/mcp/auth_callback",
      "https://claude.ai/api/mcp/auth_callback?x=1",
      "https://evil.example/cb",
      "",
    ]
    for (const uri of tentativi) expect(redirectUriAmmesso(uri)).toBe(false)
  })
})

describe("PKCE", () => {
  it("accetta il verifier che ha generato la sfida", () => {
    const verifier = segretoCasuale().padEnd(43, "a")
    expect(verificaPkce(verifier, sfidaDaVerifier(verifier))).toBe(true)
  })

  it("rifiuta un verifier diverso", () => {
    const verifier = segretoCasuale().padEnd(43, "a")
    const altro = segretoCasuale().padEnd(43, "b")
    expect(verificaPkce(altro, sfidaDaVerifier(verifier))).toBe(false)
  })

  it("rifiuta il metodo plain, anche se il valore coincide", () => {
    const verifier = segretoCasuale().padEnd(43, "a")
    expect(verificaPkce(verifier, verifier, "plain")).toBe(false)
  })

  it("rifiuta verifier fuori dai limiti della specifica", () => {
    expect(verificaPkce("corto", sfidaDaVerifier("corto"))).toBe(false)
    const lungo = "a".repeat(129)
    expect(verificaPkce(lungo, sfidaDaVerifier(lungo))).toBe(false)
  })
})

describe("access token", () => {
  const payload = {
    iss: "https://crm.solairgroup.it",
    sub: "11111111-1111-1111-1111-111111111111",
    aud: "https://crm.solairgroup.it/api/mcp",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: "abc",
    typ: "mcp-access" as const,
    ruolo: "ADMIN",
    auth_user_id: "22222222-2222-2222-2222-222222222222",
    client_id: "mcp_test",
  }

  it("torna indietro identico a chi ha la chiave", () => {
    const token = firmaAccessToken(payload, CHIAVE)
    expect(verificaAccessToken(token, CHIAVE)).toMatchObject(payload)
  })

  it("rifiuta la firma di un'altra chiave", () => {
    const token = firmaAccessToken(payload, CHIAVE)
    expect(() => verificaAccessToken(token, `${CHIAVE}-diversa`)).toThrow(ErroreTokenMcp)
  })

  it("rifiuta un payload manomesso", () => {
    const token = firmaAccessToken(payload, CHIAVE)
    const [testa, , firma] = token.split(".")
    const alterato = Buffer.from(
      JSON.stringify({ ...payload, ruolo: "SUPERADMIN" }),
      "utf8",
    ).toString("base64url")
    expect(() => verificaAccessToken(`${testa}.${alterato}.${firma}`, CHIAVE)).toThrow(ErroreTokenMcp)
  })

  it("rifiuta alg: none", () => {
    const testa = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
    const corpo = Buffer.from(JSON.stringify(payload)).toString("base64url")
    expect(() => verificaAccessToken(`${testa}.${corpo}.`, CHIAVE)).toThrow(ErroreTokenMcp)
  })

  it("rifiuta un token scaduto", () => {
    const scaduto = { ...payload, exp: Math.floor(Date.now() / 1000) - 1 }
    expect(() => verificaAccessToken(firmaAccessToken(scaduto, CHIAVE), CHIAVE)).toThrow(/scaduto/i)
  })

  it("rifiuta un token firmato da noi ma per un altro uso", () => {
    const altro = firmaJws({ ...payload, typ: "mcp-authz-req" }, CHIAVE)
    expect(() => verificaAccessToken(altro, CHIAVE)).toThrow(/non destinato/i)
  })
})

describe("parametri di /authorize", () => {
  const validi = () =>
    new URLSearchParams({
      response_type: "code",
      client_id: "mcp_test",
      redirect_uri: "https://claude.ai/api/mcp/auth_callback",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      state: "st4te",
    })

  it("accetta una richiesta conforme", () => {
    const esito = analizzaParametri(validi())
    expect(esito.ok).toBe(true)
  })

  it("tratta un redirect_uri sconosciuto come errore da mostrare, mai da seguire", () => {
    const sp = validi()
    sp.set("redirect_uri", "https://evil.example/cb")
    const esito = analizzaParametri(sp)
    expect(esito).toMatchObject({ ok: false, fatale: true })
  })

  it("rimanda al client gli errori che nascono dopo la validazione del redirect", () => {
    const sp = validi()
    sp.delete("code_challenge")
    const esito = analizzaParametri(sp)
    expect(esito).toMatchObject({ ok: false, fatale: false, codice: "invalid_request", state: "st4te" })
  })

  it("pretende PKCE S256", () => {
    const sp = validi()
    sp.set("code_challenge_method", "plain")
    expect(analizzaParametri(sp)).toMatchObject({ ok: false, fatale: false })
  })

  it("accetta solo response_type=code", () => {
    const sp = validi()
    sp.set("response_type", "token")
    expect(analizzaParametri(sp)).toMatchObject({ codice: "unsupported_response_type" })
  })
})

describe("token della richiesta di autorizzazione", () => {
  const parametri = {
    clientId: "mcp_test",
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
    codeChallenge: "sfida",
    codeChallengeMethod: "S256",
    state: "st4te",
    scope: "crm:mcp",
    resource: "https://crm.solairgroup.it/api/mcp",
  }

  it("conserva parametri e utente", () => {
    const token = firmaRichiesta(parametri, "auth-user", CHIAVE)
    const letto = verificaRichiesta(token, CHIAVE)
    expect(letto.authUserId).toBe("auth-user")
    expect(letto.parametri).toMatchObject(parametri)
  })

  it("non si lascia riscrivere il redirect_uri", () => {
    const token = firmaRichiesta(parametri, "auth-user", CHIAVE)
    const [testa, corpo, firma] = token.split(".")
    const payload = JSON.parse(Buffer.from(corpo, "base64url").toString())
    payload.redirect_uri = "https://evil.example/cb"
    const alterato = Buffer.from(JSON.stringify(payload)).toString("base64url")
    expect(() => verificaRichiesta(`${testa}.${alterato}.${firma}`, CHIAVE)).toThrow(ErroreTokenMcp)
  })
})

describe("url di ritorno", () => {
  it("porta codice e state, e salta i valori assenti", () => {
    const url = urlDiRitorno("https://claude.ai/api/mcp/auth_callback", {
      code: "abc",
      state: null,
    })
    expect(url).toBe("https://claude.ai/api/mcp/auth_callback?code=abc")
  })
})

describe("hash dei segreti", () => {
  it("e' stabile e non reversibile per confronto diretto", () => {
    const segreto = segretoCasuale()
    expect(hash(segreto)).toBe(hash(segreto))
    expect(hash(segreto)).not.toContain(segreto)
    expect(hash(segreto)).toHaveLength(64)
  })
})
