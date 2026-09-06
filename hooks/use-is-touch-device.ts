"use client"

import { useEffect, useState } from "react"

/**
 * Rileva se il dispositivo e' touch, indipendentemente dalla larghezza dello
 * schermo. Serve per il fix "doppio scroll" su Leads/Clienti/Installatori/
 * Scadenze/Compiti: quel fix usava useIsMobile (breakpoint 1023px), ma un
 * iPad in orizzontale e' largo 1024-1366px — SOPRA la soglia — quindi il
 * fix non scattava piu' e il bug del doppio scroll tornava (segnalato da
 * Nando su iPad, Leads, 04/09). Il doppio scroll e' un problema di
 * INTERAZIONE TOUCH, non di layout/larghezza: la larghezza determina se
 * mostrare tabella o card, il touch determina se serve il fix. Le due cose
 * vanno controllate separatamente.
 *
 * SSR-safe: primo render sempre `false`, valore reale dopo il mount.
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)")
    const update = () => setIsTouch(mq.matches || navigator.maxTouchPoints > 0)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  return isTouch
}
