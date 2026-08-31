import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"
import { clearCrmSessionCookies } from "@/lib/auth/session-policy"
import { nextcloudBaseUrl } from "@/lib/nextcloud/config"
import { CONSENT_ERRORS, isMissingAuthSession } from "@/lib/nextcloud/oauth-consent"
import { readSwitchState, SWITCH_COOKIE, switchRedirect } from "@/lib/nextcloud/session-switch"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  // Keep a writable cookie adapter throughout the OAuth exchange. Copy all
  // rotations/deletions onto every response, including external redirects.
  const pending = new NextResponse()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of cookies) {
          request.cookies.set(name, value)
          pending.cookies.set(name, value, options)
        }
      },
    } },
  )
  function finish(path: string | URL) {
    const response = switchRedirect(new URL(path, request.url))
    for (const cookie of pending.cookies.getAll()) response.cookies.set(cookie)
    return response
  }
  function fail(error: keyof typeof CONSENT_ERRORS) {
    return finish(`/oauth/consent?error=${error}`)
  }
  function restartLogin() {
    // Discard the old authorization and identity binding. After login, /open
    // rechecks permissions and starts a fresh switch for the actual CRM user.
    const destination = new URL("/api/auth/nextcloud/open", request.url)
    const state = readSwitchState(request.cookies.get(SWITCH_COOKIE)?.value)
    if (state) {
      destination.searchParams.set("path", state.path)
      if (state.fileId) destination.searchParams.set("fileid", state.fileId)
    }
    const login = new URL("/nextcloud/login", request.url)
    login.searchParams.set("sessione_scaduta", "1")
    login.searchParams.set("redirect", destination.pathname + destination.search)
    const response = finish(login)
    clearCrmSessionCookies(response)
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) response.cookies.set(cookie.name, "", {
        path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      })
    }
    // No global signOut: other devices must not be affected by recovery.
    return response
  }
  function report(stage: string, error: { name?: string; code?: string; status?: number } | null) {
    // Never log tokens, authorization IDs, provider URLs or user data.
    console.warn("[nextcloud-consent]", { stage, name: error?.name, code: error?.code, status: error?.status })
  }
  function complete(redirectUrl: string) {
    const target = new URL(redirectUrl)
    if (target.protocol !== "https:" || target.origin !== new URL(nextcloudBaseUrl()).origin
      || target.username || target.password) return fail("client")
    return finish(target)
  }

  const id = request.nextUrl.searchParams.get("authorization_id")
  if (!id) return fail("request")
  const allowedClientId = process.env.SUPABASE_OAUTH_NEXTCLOUD_CLIENT_ID
  if (!allowedClientId) return fail("client")

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      report("user", error)
      return !error || isMissingAuthSession(error) ? restartLogin() : fail("unavailable")
    }
    const pendingSwitch = request.cookies.get(SWITCH_COOKIE)?.value
    if (pendingSwitch) {
      const state = readSwitchState(pendingSwitch)
      if (!state || state.userId !== data.user.id) {
        const response = finish(`/documenti?nc_error=${state ? "session_switch_changed" : "session_switch_expired"}`)
        response.cookies.set(SWITCH_COOKIE, "", { path: "/api/auth/nextcloud", maxAge: 0 })
        return response
      }
    }
    const { data: details, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(id)
    if (detailsError || !details) {
      report("details", detailsError)
      return isMissingAuthSession(detailsError) ? restartLogin() : fail("request")
    }
    if ("redirect_url" in details) return complete(details.redirect_url)
    if (details.client.id !== allowedClientId) return fail("client")

    const { data: approved, error: approveError } = await supabase.auth.oauth.approveAuthorization(id)
    if (approveError || !approved?.redirect_url) {
      report("approve", approveError)
      return isMissingAuthSession(approveError) ? restartLogin() : fail("unavailable")
    }
    return complete(approved.redirect_url)
  } catch {
    report("unexpected", null)
    return fail("unavailable")
  }
}
