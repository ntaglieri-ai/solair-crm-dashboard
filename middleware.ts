// middleware.ts (nella root del progetto)
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica il JWT tramite JWKS in cache. Con chiavi asimmetriche evita il
  // roundtrip a Supabase Auth che getUser() esegue a ogni navigazione.
  const tClaims = Date.now()
  const { data: claimsData } = await supabase.auth.getClaims()
  console.log(`[perf] middleware getClaims: ${Date.now() - tClaims}ms`)
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  // Route pubbliche (non protette). Il reset password self-service e' invocato
  // da utenti NON autenticati (hanno dimenticato la password), quindi il suo
  // endpoint deve restare raggiungibile senza sessione.
  // La pagina di consenso OIDC deve poter ricevere la richiesta anche senza
  // sessione: gestisce internamente il rinvio a /login preservando
  // authorization_id, cosi' il flusso riprende dopo l'autenticazione.
  // /api/keep-warm e' pingato da Vercel Cron (nessuna sessione utente) —
  // protetto dal proprio controllo sul segreto CRON_SECRET, non da questo
  // gate di autenticazione.
  const publicRoutes = [
    "/login",
    "/oauth/consent",
    "/api/auth/password-reset",
    "/api/keep-warm",
    // Ingestion pubblica lead (chatbot/Meta Ads/configuratore) — nessuna
    // sessione CRM: si autentica da sola via API key per sorgente
    // (vedi app/api/public/lead-intake/route.ts), come /api/keep-warm sopra.
    "/api/public",
  ]
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Se non autenticato e non su route pubblica → redirect a /login
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Se autenticato e su /login → redirect a /dashboard
  if (isAuthenticated && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone()
    const requestedRedirect = request.nextUrl.searchParams.get("redirect")
    if (requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")) {
      return NextResponse.redirect(new URL(requestedRedirect, request.url))
    }
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  const isCambiaPasswordRoute = request.nextUrl.pathname === "/cambia-password"
  // L'endpoint che azzera il flag deve restare raggiungibile MENTRE il flag
  // e' ancora true, altrimenti il gate qui sotto lo re-indirizzerebbe prima
  // che possa completare l'aggiornamento (redirect loop autoreferenziale).
  const isCompletePasswordChangeRoute =
    request.nextUrl.pathname === "/api/auth/complete-password-change"

  // Cache del flag "deve cambiare password" in un cookie, per evitare un
  // giro reale al database a OGNI navigazione (trovato 25/07: il file era
  // pronto da giorni ma mai distribuito in produzione — appena arrivato in
  // produzione ha reso l'intera app lenta, perche' girava su ogni singola
  // pagina). Cache breve (60s, non ore): oggi nessuna azione admin forza
  // il reset della password di un utente già loggato, ma se in futuro
  // venisse aggiunta una funzione simile, il disallineamento resterebbe
  // comunque limitato a al massimo un minuto, non ore. Il cookie viene
  // comunque invalidato subito dopo un cambio password riuscito (vedi
  // app/api/auth/complete-password-change/route.ts).
  const MCP_COOKIE = "scrm_mcp"
  const cachedFlag = request.cookies.get(MCP_COOKIE)?.value

  // Solo dopo un login riuscito: se l'utente ha ancora la password temporanea
  // (must_change_password), blocca l'accesso a tutto il resto del CRM finche'
  // non la sostituisce. /login resta fuori da questo controllo (vedi sopra).
  if (isAuthenticated && !isPublicRoute && !isCompletePasswordChangeRoute) {
    let mustChangePassword: boolean
    let shouldCacheCookie = false

    if (cachedFlag === "0" || cachedFlag === "1") {
      mustChangePassword = cachedFlag === "1"
    } else {
      const tMcp = Date.now()
      const { data: utente } = await supabase
        .from("utenti")
        .select("must_change_password")
        .eq("auth_user_id", claimsData!.claims!.sub as string)
        .maybeSingle()
      console.log(`[perf] middleware must_change_password query: ${Date.now() - tMcp}ms`)
      mustChangePassword = utente?.must_change_password === true
      shouldCacheCookie = true
    }

    const setCacheCookie = (response: NextResponse) => {
      if (shouldCacheCookie) {
        response.cookies.set(MCP_COOKIE, mustChangePassword ? "1" : "0", {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          maxAge: 60,
          path: "/",
        })
      }
      return response
    }

    if (mustChangePassword && !isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/cambia-password"
      return setCacheCookie(NextResponse.redirect(url))
    }
    if (!mustChangePassword && isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return setCacheCookie(NextResponse.redirect(url))
    }
    setCacheCookie(supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
