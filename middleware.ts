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
  const { data: claimsData } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  // Route pubbliche (non protette). Il reset password self-service e' invocato
  // da utenti NON autenticati (hanno dimenticato la password), quindi il suo
  // endpoint deve restare raggiungibile senza sessione.
  const publicRoutes = ["/login", "/api/auth/password-reset"]
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
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  const isCambiaPasswordRoute = request.nextUrl.pathname === "/cambia-password"
  // L'endpoint che azzera il flag deve restare raggiungibile MENTRE il flag
  // e' ancora true, altrimenti il gate qui sotto lo re-indirizzerebbe prima
  // che possa completare l'aggiornamento (redirect loop autoreferenziale).
  const isCompletePasswordChangeRoute =
    request.nextUrl.pathname === "/api/auth/complete-password-change"

  // Solo dopo un login riuscito: se l'utente ha ancora la password temporanea
  // (must_change_password), blocca l'accesso a tutto il resto del CRM finche'
  // non la sostituisce. /login resta fuori da questo controllo (vedi sopra).
  if (isAuthenticated && !isPublicRoute && !isCompletePasswordChangeRoute) {
    const { data: utente } = await supabase
      .from("utenti")
      .select("must_change_password")
      .eq("auth_user_id", claimsData!.claims!.sub as string)
      .maybeSingle()
    const mustChangePassword = utente?.must_change_password === true

    if (mustChangePassword && !isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/cambia-password"
      return NextResponse.redirect(url)
    }
    if (!mustChangePassword && isCambiaPasswordRoute) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
