"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

const DEFAULT_TIMEOUT_SECONDS = 30 * 60
const TOUCH_THROTTLE_MS = 60 * 1000
const IDLE_CHECK_MS = 30 * 1000

function defaultTimeoutSeconds() {
  const raw = process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_SECONDS
  const value = raw ? Number.parseInt(raw, 10) : DEFAULT_TIMEOUT_SECONDS
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_SECONDS
}

export function SessionTimeoutGuard() {
  const router = useRouter()
  const [timeoutSeconds, setTimeoutSeconds] = useState(defaultTimeoutSeconds)
  const lastActivityRef = useRef(0)
  const lastTouchRef = useRef(0)
  const logoutStartedRef = useRef(false)

  useEffect(() => {
    let idleTimer: number | undefined
    const timeoutMs = timeoutSeconds * 1000
    if (lastActivityRef.current === 0) lastActivityRef.current = Date.now()

    async function expireSession() {
      if (logoutStartedRef.current) return
      logoutStartedRef.current = true
      try {
        const res = await fetch("/api/auth/logout", { method: "POST", keepalive: true })
        const body = (await res.json().catch(() => null)) as { nextcloudLogoutUrl?: string } | null
        if (body?.nextcloudLogoutUrl) {
          // Stesso motivo del logout manuale in sidebar.tsx: la sessione
          // Nextcloud nativa e' su un cookie separato, il logout CRM non
          // la tocca.
          fetch(body.nextcloudLogoutUrl, { mode: "no-cors", credentials: "include", keepalive: true }).catch(() => {})
        }
      } catch {
        /* il redirect resta comunque lato client */
      }
      router.replace("/login?sessione_scaduta=1")
      router.refresh()
    }

    function scheduleIdleTimer() {
      if (idleTimer) window.clearTimeout(idleTimer)
      const elapsed = Date.now() - lastActivityRef.current
      idleTimer = window.setTimeout(expireSession, Math.max(timeoutMs - elapsed, 0))
    }

    async function touchSession() {
      if (logoutStartedRef.current) return
      const now = Date.now()
      if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return
      lastTouchRef.current = now

      try {
        const response = await fetch("/api/auth/session/touch", {
          method: "POST",
          cache: "no-store",
        })
        if (response.status === 401) {
          await expireSession()
          return
        }
        const payload = (await response.json().catch(() => null)) as {
          timeoutSeconds?: number
        } | null
        if (payload?.timeoutSeconds && payload.timeoutSeconds !== timeoutSeconds) {
          setTimeoutSeconds(payload.timeoutSeconds)
        }
      } catch {
        /* il middleware server-side resta l'autorita' in caso di rete assente */
      }
    }

    function markActivity() {
      lastActivityRef.current = Date.now()
      scheduleIdleTimer()
      void touchSession()
    }

    function markVisibleActivity() {
      if (document.visibilityState === "visible") markActivity()
    }

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "mousemove",
      "scroll",
      "focus",
    ]
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }))
    document.addEventListener("visibilitychange", markVisibleActivity)

    void touchSession()
    scheduleIdleTimer()
    const idleInterval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) void expireSession()
    }, IDLE_CHECK_MS)

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity))
      document.removeEventListener("visibilitychange", markVisibleActivity)
      window.clearInterval(idleInterval)
      if (idleTimer) window.clearTimeout(idleTimer)
    }
  }, [router, timeoutSeconds])

  return null
}
