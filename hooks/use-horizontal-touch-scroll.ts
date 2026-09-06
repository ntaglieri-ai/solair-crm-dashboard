"use client"

import { useCallback, useRef, type TouchEvent } from "react"

type TouchPanState = {
  axis: "x" | "y" | null
  startScrollLeft: number
  startX: number
  startY: number
}

export function useHorizontalTouchScroll(
  onScrollLeftChange?: (el: HTMLDivElement) => void,
) {
  const panRef = useRef<TouchPanState | null>(null)

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    if (event.touches.length !== 1 || el.scrollWidth <= el.clientWidth) {
      panRef.current = null
      return
    }

    const touch = event.touches[0]
    panRef.current = {
      axis: null,
      startScrollLeft: el.scrollLeft,
      startX: touch.clientX,
      startY: touch.clientY,
    }
  }, [])

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const pan = panRef.current
      if (!pan || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - pan.startX
      const deltaY = touch.clientY - pan.startY
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (!pan.axis) {
        if (absX < 6 && absY < 6) return
        pan.axis = absX > absY * 1.2 ? "x" : "y"
      }

      if (pan.axis !== "x") return

      if (event.cancelable) event.preventDefault()
      const el = event.currentTarget
      el.scrollLeft = pan.startScrollLeft - deltaX
      onScrollLeftChange?.(el)
    },
    [onScrollLeftChange],
  )

  const onTouchEnd = useCallback(() => {
    panRef.current = null
  }, [])

  return {
    onTouchCancel: onTouchEnd,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
  }
}
