"use client"

import { useEffect, useRef, type ReactNode } from "react"

/**
 * Ancora in alto l'header di dettaglio (Lead / Cliente) durante lo scroll e
 * pubblica la propria altezza in `--detail-header-h`, cosi' la navbar delle
 * sezioni — che sta in un altro ramo dell'albero, dentro la colonna dei
 * contenuti — puo' agganciarsi subito sotto senza che l'offset sia scritto a
 * mano da qualche parte. L'altezza cambia davvero: il nome va a capo, i tag
 * si accumulano, le pillole info si riavvolgono sui viewport stretti.
 *
 * Lo sticky parte solo da `lg`. Sotto quella soglia la topbar mobile e' gia'
 * fissa in cima (h-20, z-50) e la navbar sezioni occupa piu' righe: ancorare
 * anche header e navbar mangerebbe mezzo schermo.
 *
 * I margini negativi servono a coprire il padding di <main> (lg:px-8 lg:py-7):
 * senza, il contenuto scorrerebbe visibile nell'intercapedine attorno alla
 * card, che e' arrotondata e non copre la larghezza piena.
 */
export function StickyDetailHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const apply = () => {
      root.style.setProperty("--detail-header-h", `${Math.round(el.getBoundingClientRect().height)}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--detail-header-h")
    }
  }, [])

  return (
    <div
      ref={ref}
      className="bg-background lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:-mt-7 lg:px-8 lg:pb-2 lg:pt-7"
    >
      {children}
    </div>
  )
}
