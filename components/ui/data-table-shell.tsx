"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

const SCROLLER_CLASS =
  "min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto overflow-x-hidden bg-card outline-none [scroll-behavior:auto] focus-visible:ring-2 focus-visible:ring-ring/40 [scrollbar-color:var(--color-muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:w-2.5"

const H_SCROLL_CLASS =
  "shrink-0 overscroll-contain overflow-x-auto overflow-y-hidden border-t border-border bg-card [scroll-behavior:auto] [scrollbar-color:var(--color-muted-foreground)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-muted/40 [&::-webkit-scrollbar]:h-2.5"

export function DataTableShell({
  children,
  ariaLabel,
  minTableWidth = "100%",
  className,
  tableClassName,
  onScroll,
}: {
  children: ReactNode
  ariaLabel: string
  minTableWidth?: number | string
  className?: string
  tableClassName?: string
  onScroll?: (el: HTMLDivElement) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hScrollRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ contentWidth: 0, hasX: false })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const measure = () => {
      const contentWidth = el.scrollWidth
      setMetrics({
        contentWidth,
        hasX: contentWidth - el.clientWidth > 1,
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [children])

  const syncBarFromContainer = useCallback((el: HTMLDivElement) => {
    const bar = hScrollRef.current
    if (bar && bar.scrollLeft !== el.scrollLeft) bar.scrollLeft = el.scrollLeft
  }, [])

  const syncContainerFromBar = useCallback(() => {
    const bar = hScrollRef.current
    const el = scrollRef.current
    if (bar && el && el.scrollLeft !== bar.scrollLeft) {
      el.scrollLeft = bar.scrollLeft
    }
  }, [])

  return (
    <div
      className={cn(
        "flex h-[calc(100svh-17rem)] min-h-[360px] max-h-[720px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div
        ref={scrollRef}
        tabIndex={0}
        role="grid"
        aria-label={ariaLabel}
        onScroll={(event) => {
          onScroll?.(event.currentTarget)
          syncBarFromContainer(event.currentTarget)
        }}
        onWheel={(event) => {
          const el = event.currentTarget
          if (el.scrollWidth <= el.clientWidth) return

          const absX = Math.abs(event.deltaX)
          const absY = Math.abs(event.deltaY)
          const shiftedWheel = event.shiftKey && absY >= 4
          const intentionalTrackpadX = absX >= 10 && absX > absY * 1.35
          if (!shiftedWheel && !intentionalTrackpadX) return

          event.preventDefault()
          const delta = shiftedWheel ? event.deltaY : event.deltaX
          el.scrollLeft += delta * 0.72
        }}
        className={SCROLLER_CLASS}
      >
        <table
          data-slot="table"
          className={cn("caption-bottom table-fixed text-sm", tableClassName)}
          style={{ width: minTableWidth, minWidth: "100%" }}
        >
          {children}
        </table>
      </div>

      {metrics.hasX ? (
        <div
          ref={hScrollRef}
          aria-hidden
          onScroll={syncContainerFromBar}
          onWheel={(event) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
            event.preventDefault()
            const el = scrollRef.current
            if (el) el.scrollTop += event.deltaY
          }}
          className={H_SCROLL_CLASS}
        >
          <div style={{ width: metrics.contentWidth }} className="h-px" />
        </div>
      ) : null}
    </div>
  )
}
