// middleware.ts (nella root del progetto)
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  clearCrmSessionCookies,
  CRM_IDLE_TIMEOUT_COOKIE,
  CRM_LAST_ACTIVITY_COOKIE,
  CRM_SESSION_COOKIE,
  idleTimeoutFromCookie,
  MUST_CHANGE_PASSWORD_COOKIE,
  setCrmSessionCookies,
} from "@/lib/auth/session-policy"

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

const NEXTCLOUD_LOGIN_PATH = "/nextcloud/login"

function requestedPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`
}

function loginPathForRequest(request: NextRequest) {
  return request.nextUrl.pathname === "/api/auth/nextcloud/open" ||
    request.nextUrl.pathname === "/api/auth/nextcloud/authorize" ||
    request.nextUrl.pathname === "/oauth/consent"
    ? NEXTCLOUD_LOGIN_PATH
    : "/login"
}

function isNextcloudRedirect(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return false
  const parsed = new URL(value, "https://solair.local")
  return (
    parsed.pathname === "/api/auth/nextcloud/open" ||
    parsed.pathname === "/oauth/consent"
  )
}

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  clearCrmSessionCookies(response)
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name === MUST_CHANGE_PASSWORD_COOKIE) {
      response.cookies.set(cookie.name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      })
    }
  }
  return response
}

function redirectToExpiredLogin(request: NextRequest) {
  const url = request.nextUrl.clone()
  const returnPath = requestedPath(request)
  url.pathname = loginPathForRequest(request)
  url.search = ""
  url.searchParams.set("sessione_scaduta", "1")
  if (returnPath !== "/") {
    url.searchParams.set("redirect", returnPath)
  }
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  // Exact HEAD-only readiness probe; GET still requires CRM authentication.
  if (request.method === "HEAD" && request.nextUrl.pathname === "/api/auth/nextcloud/resume") {
    return NextResponse.next()
  }
  let supabaseResponse = NextResponse.next({ request })
  // Supabase may rotate or delete cookies before we decide to redirect.
  // Every redirect must carry those changes back to the browser.
  const withAuthCookies = (response: NextResponse) => {
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie)
    response.headers.set("Cache-Control", "no-store")
    return response
  }

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
          supabaseResponse = withAuthCookies(NextResponse.next({ request }))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verifica il JWT tramite JWKS in cache. Con chiavi asimmetriche evita il
  // roundtrip a Supabase Auth che getUser() esegue a ogni navigazione.
  const { data: claimsData } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  // Route pubbliche (non protette). Il reset password self-service e' invocato
  // da utenti NON autenticati (hanno dimenticato la password), quindi il suo
  // endpoint deve restare raggiungibile senza sessione.
  // La pagina di consenso OIDC deve poter ricevere la richiesta anche senza
  // sessione: gestisce internamente il rinvio a /login preservando
  // authorization_id, cosi' il flusso riprende dopo l'autenticazione.
  // /api/keep-warm e /api/cron sono pingati da Vercel Cron (nessuna sessione utente) —
  // protetto dal proprio controllo sul segreto CRON_SECRET, non da questo
  // gate di autenticazione.
  const publicRoutes = [
    "/login",
    NEXTCLOUD_LOGIN_PATH,
    "/oauth/consent",
    "/api/auth/nextcloud/authorize",
    // Autenticazione: chi la chiama non ha ancora una sessione, per definizione.
    // La rotta si difende da sola (throttle per IP, blocco IP, soglia tentativi).
    "/api/auth/login",
    "/api/auth/session/touch",
    "/api/auth/password-reset",
    // Registra l'esito dei tentativi di login nell'audit log: un login fallito
    // per definizione non ha sessione, quindi deve poter passare senza gate.
    "/api/auth/audit-login",
    "/api/keep-warm",
    "/api/cron",
    // Webhook Meta Lead Ads: la route gestisce internamente verifica
    // hub.challenge e firma X-Hub-Signature-256.
    "/api/meta/webhook",
    // Ingestion pubblica lead (chatbot/Meta Ads/configuratore) — nessuna
    // sessione CRM: si autentica da sola via API key per sorgente
    // (vedi app/api/public/lead-intake/route.ts), come /api/keep-warm sopra.
    "/api/public",
    // Server MCP: il client e' Claude, non un browser, quindi non ha e non
    // puo' avere il cookie di sessione CRM. Si difende da solo verificando il
    // token di accesso prima di leggere il corpo della richiesta
    // (vedi app/api/mcp/route.ts e lib/mcp/oauth/identita.ts).
    "/api/mcp",
    // OAuth del connettore MCP. Metadata, registrazione dinamica e /token
    // vengono chiamati da chi una sessione non ce l'ha ancora, per
    // definizione: il gate qui sotto li respingerebbe tutti verso /login.
    // La pagina /oauth/mcp/authorize e' pubblica per lo stesso motivo per cui
    // lo e' /oauth/consent: deve poter ricevere la richiesta senza sessione e
    // rimandare lei a /login preservando i parametri OAuth, altrimenti il
    // redirect qui sotto li perderebbe per strada.
    "/api/oauth-mcp",
    "/oauth/mcp",
    "/.well-known/oauth-",
  ]
  // Alias sulla radice del dominio, riscritti in next.config.mjs verso gli
  // endpoint OAuth. Confronto esatto e non per prefisso: "/token" come
  // prefisso renderebbe pubblica qualunque rotta futura che inizi per token.
  const aliasOAuthMcp = ["/authorize", "/token", "/register"]
  const isPublicRoute =
    publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route)) ||
    aliasOAuthMcp.includes(request.nextUrl.pathname)
  const isSessionTouchRoute = request.nextUrl.pathname === "/api/auth/session/touch"
  const hasCrmSession =
    request.cookies.get(CRM_SESSION_COOKIE)?.value === "1" &&
    Boolean(request.cookies.get(CRM_LAST_ACTIVITY_COOKIE)?.value)

  if (isAuthenticated && !hasCrmSession && !isSessionTouchRoute) {
    if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === NEXTCLOUD_LOGIN_PATH) {
      return clearAuthCookies(supabaseResponse, request)
    }
    // Le pagine di autorizzazione OAuth (Nextcloud e connettore MCP) sono
    // pubbliche per necessita', ma con una sessione Supabase viva e la
    // sessione CRM scaduta devono comunque passare da un login fresco: sono
    // l'unico punto in cui una sessione dimenticata diventerebbe un accesso
    // concesso a un'applicazione esterna.
    const isPaginaAutorizzazione =
      request.nextUrl.pathname === "/oauth/consent" ||
      request.nextUrl.pathname === "/api/auth/nextcloud/authorize" ||
      request.nextUrl.pathname.startsWith("/oauth/mcp") ||
      request.nextUrl.pathname === "/authorize"
    if (!isPublicRoute || isPaginaAutorizzazione) {
      return clearAuthCookies(withAuthCookies(redirectToExpiredLogin(request)), request)
    }
  }

  // Se non autenticato e non su route pubblica → redirect a /login
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = loginPathForRequest(request)
    url.search = ""
    if (url.pathname === NEXTCLOUD_LOGIN_PATH) {
      url.searchParams.set("redirect", requestedPath(request))
    }
    return withAuthCookies(NextResponse.redirect(url))
  }

  // Se autenticato e su una pagina di login, entra nella destinazione richiesta.
  const isNextcloudLogin = request.nextUrl.pathname === NEXTCLOUD_LOGIN_PATH
  if (
    isAuthenticated &&
    (request.nextUrl.pathname === "/login" || isNextcloudLogin)
  ) {
    const url = request.nextUrl.clone()
    const requestedRedirect = request.nextUrl.searchParams.get("redirect")
    if (
      requestedRedirect?.startsWith("/") &&
      !requestedRedirect.startsWith("//") &&
      (!isNextcloudLogin || isNextcloudRedirect(requestedRedirect))
    ) {
      return withAuthCookies(NextResponse.redirect(new URL(requestedRedirect, request.url)))
    }
    url.pathname = isNextcloudLogin ? "/api/auth/nextcloud/open" : "/"
    return withAuthCookies(NextResponse.redirect(url))
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
      const { data: utente } = await supabase
        .from("utenti")
        .select("must_change_password")
        .eq("auth_user_id", claimsData!.claims!.sub as string)
        .maybeSingle()
      mustChangePassword = utente?.must_change_password === true
      shouldCacheCookie = true
    }

    // Il timeout non si rilegge dal database a ogni richiesta: e' gia' stato
    // risolto da /api/auth/login o dal keepalive e stampato nel cookie.
    const idleTimeout = idleTimeoutFromCookie(
      request.cookies.get(CRM_IDLE_TIMEOUT_COOKIE)?.value,
    )

    const setCacheCookie = (response: NextResponse) => {
      if (shouldCacheCookie) {
        response.cookies.set(MCP_COOKIE, mustChangePassword ? "1" : "0", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60,
          path: "/",
        })
      }
      setCrmSessionCookies(response, idleTimeout)
      return response
    }

    if (mustChangePassword && !isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/cambia-password"
      return setCacheCookie(withAuthCookies(NextResponse.redirect(url)))
    }
    if (!mustChangePassword && isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return setCacheCookie(withAuthCookies(NextResponse.redirect(url)))
    }
    setCacheCookie(supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
