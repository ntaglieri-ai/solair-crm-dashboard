import type { NextResponse } from "next/server"

export const CRM_SESSION_COOKIE = "scrm_session"
export const CRM_LAST_ACTIVITY_COOKIE = "scrm_last_activity"
export const MUST_CHANGE_PASSWORD_COOKIE = "scrm_mcp"
export const NEXTCLOUD_SWITCH_COOKIE = "scrm_nc_switch"
export const NEXTCLOUD_SWITCH_COOKIE_PATH = "/api/auth/nextcloud"

/**
 * Timeout di inattivita' risolto, in secondi.
 *
 * Esiste perche' il valore vero vive su crm_settings.session_timeout_minutes,
 * ma il middleware gira su OGNI richiesta e non puo' andarselo a leggere dal
 * database: sarebbe la stessa lezione gia' pagata con must_change_password.
 * Il valore viene quindi risolto dove una query costa poco — /api/auth/login e
 * /api/auth/session/touch — e stampato qui, cosi' il middleware lo rilegge dal
 * cookie a costo zero.
 *
 * Cookie di sessione (nessun maxAge): sparisce alla chiusura del browser, esattamente
 * come CRM_SESSION_COOKIE, che senza il suo compagno manda comunque a /login.
 */
export const CRM_IDLE_TIMEOUT_COOKIE = "scrm_idle"

const DEFAULT_IDLE_TIMEOUT_SECONDS = 30 * 60
const MIN_IDLE_TIMEOUT_SECONDS = 5 * 60
const MAX_IDLE_TIMEOUT_SECONDS = 12 * 60 * 60

function clamp(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_IDLE_TIMEOUT_SECONDS
  return Math.min(Math.max(value, MIN_IDLE_TIMEOUT_SECONDS), MAX_IDLE_TIMEOUT_SECONDS)
}

/**
 * Ripiego quando il valore di database non e' ancora stato stampato nel cookie
 * (prima richiesta dopo un riavvio del browser, o service_role non configurata).
 * Resta la vecchia env var, cosi' un ambiente che la imposta non cambia
 * comportamento da un giorno all'altro.
 */
export function sessionIdleTimeoutSeconds(): number {
  const raw =
    process.env.SESSION_IDLE_TIMEOUT_SECONDS ??
    process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS
  const value = raw ? Number.parseInt(raw, 10) : DEFAULT_IDLE_TIMEOUT_SECONDS
  return clamp(value)
}

/** Legge il timeout dal cookie stampato al login/keepalive, con ripiego. */
export function idleTimeoutFromCookie(raw: string | undefined): number {
  if (!raw) return sessionIdleTimeoutSeconds()
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) return sessionIdleTimeoutSeconds()
  return clamp(value)
}

export function setCrmSessionCookies(response: NextResponse, timeoutSeconds?: number) {
  const secure = process.env.NODE_ENV === "production"
  const idle = clamp(timeoutSeconds ?? sessionIdleTimeoutSeconds())

  response.cookies.set(CRM_SESSION_COOKIE, "1", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  response.cookies.set(CRM_IDLE_TIMEOUT_COOKIE, String(idle), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  })
  // La scadenza del cookie E' il timeout: quando il browser lo lascia scadere,
  // il middleware non trova piu' l'ultima attivita' e manda a /login. Non c'e'
  // un secondo meccanismo da tenere allineato.
  response.cookies.set(CRM_LAST_ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: idle,
    path: "/",
  })
}

export function clearCrmSessionCookies(response: NextResponse) {
  // Cancel any pending browser handoff on logout or CRM session expiration.
  response.cookies.set(NEXTCLOUD_SWITCH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: NEXTCLOUD_SWITCH_COOKIE_PATH,
  })
  for (const name of [
    CRM_SESSION_COOKIE,
    CRM_LAST_ACTIVITY_COOKIE,
    CRM_IDLE_TIMEOUT_COOKIE,
    MUST_CHANGE_PASSWORD_COOKIE,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })
  }
}
