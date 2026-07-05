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
      className="fixed inset-y-0 right-0 z-20 bg-background px-5 py-6 lg:left-[248px] lg:px-8 lg:py-7"
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-primary/10">
        <div className="h-full w-2/5 animate-[navigation-progress_900ms_ease-in-out_infinite] bg-primary" />
      </div>
      <div className="mx-auto flex w-full max-w-[1540px] animate-pulse flex-col gap-5">
        <div className="space-y-3">
          <div className="h-9 w-64 rounded-lg bg-muted" />
          <div className="h-5 w-96 max-w-full rounded-md bg-muted/70" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-lg bg-muted" />
          <div className="h-10 w-36 rounded-lg bg-muted" />
          <div className="h-10 w-32 rounded-lg bg-muted" />
        </div>
        <div className="h-14 rounded-lg border border-border bg-card shadow-sm" />
        <div className="min-h-[430px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="h-12 border-b border-border bg-muted/70" />
          <div className="divide-y divide-border">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex h-14 items-center gap-5 px-5">
                <div className="size-4 rounded bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-4 w-56 rounded bg-muted/70" />
                <div className="ml-auto h-4 w-24 rounded bg-muted/70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
