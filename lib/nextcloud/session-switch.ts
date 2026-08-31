import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { NEXTCLOUD_SWITCH_COOKIE, NEXTCLOUD_SWITCH_COOKIE_PATH } from "@/lib/auth/session-policy"
import { basicAuth, nextcloudAdminConfig, nextcloudBaseUrl, nextcloudCredKey, ocsHeaders } from "./config"

export const SWITCH_COOKIE = NEXTCLOUD_SWITCH_COOKIE
export const RESUME_PATH = "/api/auth/nextcloud/resume"
export const SWITCH_TTL = 180
export const SWITCH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: NEXTCLOUD_SWITCH_COOKIE_PATH,
}

type SwitchState = { userId: string; path: string; fileId: string | null; expires: number }

function signature(payload: string) {
  return createHmac("sha256", nextcloudCredKey()).update(`nc-browser-switch-v1:${payload}`).digest("base64url")
}

export function sealSwitchState(userId: string, path: string, fileId: string | null, now = Date.now()) {
  const state: SwitchState = { userId, path, fileId, expires: now + SWITCH_TTL * 1000 }
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url")
  const value = `${payload}.${signature(payload)}`
  if (value.length > 3500) throw new Error("Nextcloud destination too long")
  return value
}

export function readSwitchState(value: string | undefined, now = Date.now()): SwitchState | null {
  if (!value || value.length > 3500) return null
  try {
    const [payload, supplied, extra] = value.split(".")
    if (!payload || !supplied || extra !== undefined) return null
    const expected = Buffer.from(signature(payload))
    const received = Buffer.from(supplied)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as SwitchState
    if (typeof state.userId !== "string" || !state.userId || typeof state.path !== "string"
      || (state.fileId !== null && typeof state.fileId !== "string")
      || !Number.isFinite(state.expires) || state.expires <= now || state.expires > now + SWITCH_TTL * 1000) return null
    return state
  } catch {
    return null
  }
}

export function switchRedirect(target: string | URL) {
  const response = NextResponse.redirect(target)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}

export function clearSwitchCookie(response: NextResponse) {
  response.cookies.set(SWITCH_COOKIE, "", { ...SWITCH_COOKIE_OPTIONS, maxAge: 0 })
  return response
}

export function oidcLoginUrl(redirectPath: string) {
  const base = new URL(nextcloudBaseUrl())
  const url = new URL(process.env.NEXTCLOUD_OIDC_LOGIN_URL ?? `${nextcloudBaseUrl()}/apps/user_oidc/login/3`)
  if (url.origin !== base.origin || url.protocol !== "https:" || url.username || url.password
    || !/\/apps\/user_oidc\/login\/\d+$/.test(url.pathname)) {
    throw new Error("Invalid Nextcloud OIDC login URL")
  }
  url.searchParams.set("redirectUrl", redirectPath)
  return url
}

/** Fail closed until the deployed callback and the actual provider agree. */
export async function assertSwitchProviderReady(origin: string) {
  const config = nextcloudAdminConfig()
  if (!config) throw new Error("Nextcloud provider verification unavailable")
  const login = oidcLoginUrl("/")
  const providerId = Number(login.pathname.split("/").pop())
  const response = await fetch(`${config.baseUrl}/ocs/v2.php/apps/user_oidc/api/v1/provider?format=json`, {
    headers: ocsHeaders({ Authorization: basicAuth(config.adminUser, config.adminPassword) }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error("Nextcloud provider verification failed")
  const body = await response.json()
  const providers = body.ocs?.data
  const provider = Array.isArray(providers) ? providers.find((item: { id: number }) => item.id === providerId) : null
  const callback = new URL(RESUME_PATH, origin).href
  if (provider?.endSessionEndpoint !== callback || provider?.postLogoutUri !== callback) {
    throw new Error("Nextcloud session switch is not configured for this CRM origin")
  }
}
