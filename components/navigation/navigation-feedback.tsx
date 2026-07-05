"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function NavigationFeedback() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setPending(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [pathname, searchParams])

  useEffect(() => {
    const start = () => {
      setPending(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setPending(false), 10_000)
    }

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      const current = `${window.location.pathname}${window.location.search}`
      const next = `${destination.pathname}${destination.search}`
      if (current === next || destination.hash) return
      start()
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", start)
    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", start)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!pending) return null

  return (
    <div
      role="status"
      aria-label="Caricamento pagina"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/10 lg:left-[248px]"
    >
      <div className="h-full w-2/5 animate-[navigation-progress_900ms_ease-in-out_infinite] bg-primary" />
    </div>
  )
}
