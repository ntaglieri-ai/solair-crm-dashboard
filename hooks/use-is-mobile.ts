"use client"

import { useEffect, useState } from "react"

/**
 * Rileva se il viewport è sotto il breakpoint indicato (default: 1023px,
 * coerente con il breakpoint `lg` usato per alternare tabella desktop /
 * lista a card su leads, clienti, installatori, ecc.).
 *
 * SSR-safe: il primo render restituisce sempre `false` per evitare
 * mismatch di idratazione; il valore reale arriva subito dopo il mount.
 */
export function useIsMobile(breakpoint = 1023): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [breakpoint])

  return isMobile
}
