import { NextResponse } from "next/server"

import { creaCodice, segnaUsoClient } from "@/lib/mcp/oauth/archivio"
import { chiaveDiFirma } from "@/lib/mcp/oauth/cripto"
import { verificaAuthUserId } from "@/lib/mcp/oauth/identita"
import { urlDiRitorno, verificaRichiesta } from "@/lib/mcp/oauth/richiesta"
import { createClient } from "@/lib/supabase/server"

/**
 * Conferma dell'autorizzazione: e' il POST del pulsante "Autorizza Claude".
 *
 * Tre verifiche, tutte necessarie:
 *  1. il token di richiesta e' firmato da noi e non scaduto — quindi i
 *     parametri (redirect_uri in testa) sono quelli validati dalla pagina e
 *     non quelli che qualcuno ha riscritto nel frattempo;
 *  2. la sessione del browser appartiene allo STESSO utente per cui il token e'
 *     stato firmato — e' quello che rende inutile un POST costruito da un altro
 *     sito con i cookie della vittima;
 *  3. ruolo e stato dell'account, riletti adesso: fra il caricamento della
 *     pagina e il click puo' essere passato del tempo.
 *
 * Solo dopo nasce il codice, che vive 60 secondi e vale una volta sola.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function paginaErrore(titolo: string, messaggio: string, stato: number): NextResponse {
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${titolo}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#EEF1F9;margin:0;
display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.c{background:#fff;border-radius:12px;padding:32px;max-width:520px;box-shadow:0 10px 30px rgba(15,32,50,.12)}
h1{color:#1E3A5F;font-size:20px;margin:0 0 12px}p{color:#4b5563;font-size:14px;line-height:1.6;margin:0}</style>
</head><body><div class="c"><h1>${titolo}</h1><p>${messaggio}</p></div></body></html>`
  return new NextResponse(html, {
    status: stato,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const token = form?.get("richiesta")
  if (typeof token !== "string" || !token) {
    return paginaErrore("Richiesta incompleta", "Manca il token di autorizzazione.", 400)
  }

  let richiesta
  try {
    richiesta = verificaRichiesta(token, chiaveDiFirma())
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : "Token non valido"
    return paginaErrore(
      "Autorizzazione scaduta",
      `${messaggio}. Torna su Claude e riavvia il collegamento.`,
      400,
    )
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub as string | undefined
  if (!authUserId || authUserId !== richiesta.authUserId) {
    return paginaErrore(
      "Sessione non corrispondente",
      "La sessione del browser non e' quella con cui e' iniziato il collegamento. Rientra nel CRM e riprova.",
      403,
    )
  }

  const esito = await verificaAuthUserId(authUserId)
  if (!esito.ok) {
    return paginaErrore("Collegamento non autorizzato", esito.descrizione, 403)
  }

  const parametri = richiesta.parametri
  const codice = await creaCodice({
    clientId: parametri.clientId,
    redirectUri: parametri.redirectUri,
    codeChallenge: parametri.codeChallenge,
    codeChallengeMethod: parametri.codeChallengeMethod,
    resource: parametri.resource,
    scope: parametri.scope,
    utenteId: esito.identita.utenteId,
    authUserId: esito.identita.authUserId,
    ruolo: esito.identita.ruolo,
  })
  await segnaUsoClient(parametri.clientId)

  console.log(
    `[mcp-oauth] codice emesso per utente=${esito.identita.utenteId} ruolo=${esito.identita.ruolo} client=${parametri.clientId}`,
  )

  // 303: il browser deve passare da POST a GET sul callback di Claude.
  return NextResponse.redirect(
    urlDiRitorno(parametri.redirectUri, { code: codice, state: parametri.state }),
    { status: 303, headers: { "Cache-Control": "no-store" } },
  )
}
