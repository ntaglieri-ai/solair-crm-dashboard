import { NextRequest } from "next/server"
import { resolveBrowserAccess } from "@/lib/nextcloud/browser-access"
import {
  assertSwitchProviderReady, clearSwitchCookie, oidcLoginUrl, sealSwitchState,
  SWITCH_COOKIE, SWITCH_COOKIE_OPTIONS, SWITCH_TTL, switchRedirect,
} from "@/lib/nextcloud/session-switch"

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? ""
  const fileId = request.nextUrl.searchParams.get("fileid")
  const access = await resolveBrowserAccess(path, fileId)
  if (access.error === "/login") {
    const login = new URL("/nextcloud/login", request.url)
    login.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return clearSwitchCookie(switchRedirect(login))
  }
  if (access.error) return clearSwitchCookie(switchRedirect(new URL(access.error, request.url)))

  try {
    await assertSwitchProviderReady(request.nextUrl.origin)
    const state = sealSwitchState(access.userId!, path, fileId)
    // Direct /sls on an anonymous browser has no provider to return to.
    // /login establishes one if needed; an existing OIDC session goes to /sls
    // immediately. The logout then returns to the CRM resume endpoint.
    const response = switchRedirect(oidcLoginUrl("/apps/user_oidc/sls"))
    response.cookies.set(SWITCH_COOKIE, state, { ...SWITCH_COOKIE_OPTIONS, maxAge: SWITCH_TTL })
    return response
  } catch {
    // Never fall back to opening documents with an unverified old identity.
    return clearSwitchCookie(switchRedirect(new URL("/documenti?nc_error=session_switch_unavailable", request.url)))
  }
}
