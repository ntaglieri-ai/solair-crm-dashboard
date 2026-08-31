import { NextRequest, NextResponse } from "next/server"
import { resolveBrowserAccess } from "@/lib/nextcloud/browser-access"
import {
  clearSwitchCookie, oidcLoginUrl, readSwitchState, SWITCH_COOKIE, switchRedirect,
} from "@/lib/nextcloud/session-switch"

// Read-only readiness probe. GET remains protected by CRM middleware.
export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-Nextcloud-Session-Switch": "v1" },
  })
}

export async function GET(request: NextRequest) {
  const rawState = request.cookies.get(SWITCH_COOKIE)?.value
  const state = readSwitchState(rawState)
  const finish = (target: string | URL) => clearSwitchCookie(switchRedirect(target))
  // Ordinary Nextcloud logouts have no pending open: do not log back in.
  // Never trust post_logout_redirect_uri or other callback query parameters.
  if (!state) {
    return finish(new URL(rawState ? "/documenti?nc_error=session_switch_expired" : "/documenti", request.url))
  }
  const access = await resolveBrowserAccess(state.path, state.fileId)
  if (access.error) return finish(new URL(access.error, request.url))
  if (access.userId !== state.userId) {
    return finish(new URL("/documenti?nc_error=session_switch_changed", request.url))
  }
  try {
    // Nextcloud has cleared its session. OIDC now uses the current CRM user.
    // Never call Supabase signOut from this callback.
    return finish(oidcLoginUrl(access.redirectPath!))
  } catch {
    return finish(new URL("/documenti?nc_error=session_switch_unavailable", request.url))
  }
}
