import type { NextResponse } from "next/server"

export const CRM_SESSION_COOKIE = "scrm_session"
export const CRM_LAST_ACTIVITY_COOKIE = "scrm_last_activity"
export const MUST_CHANGE_PASSWORD_COOKIE = "scrm_mcp"

const DEFAULT_IDLE_TIMEOUT_SECONDS = 30 * 60
const MIN_IDLE_TIMEOUT_SECONDS = 5 * 60
const MAX_IDLE_TIMEOUT_SECONDS = 12 * 60 * 60

export function sessionIdleTimeoutSeconds(): number {
  const raw =
    process.env.SESSION_IDLE_TIMEOUT_SECONDS ??
    process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS
  const value = raw ? Number.parseInt(raw, 10) : DEFAULT_IDLE_TIMEOUT_SECONDS

  if (!Number.isFinite(value)) return DEFAULT_IDLE_TIMEOUT_SECONDS
  return Math.min(Math.max(value, MIN_IDLE_TIMEOUT_SECONDS), MAX_IDLE_TIMEOUT_SECONDS)
}

export function setCrmSessionCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production"

  response.cookies.set(CRM_SESSION_COOKIE, "1", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  response.cookies.set(CRM_LAST_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: sessionIdleTimeoutSeconds(),
    path: "/",
  })
}

export function clearCrmSessionCookies(response: NextResponse) {
  for (const name of [CRM_SESSION_COOKIE, CRM_LAST_ACTIVITY_COOKIE, MUST_CHANGE_PASSWORD_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })
  }
}
