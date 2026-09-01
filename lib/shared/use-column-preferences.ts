"use client"

import { useEffect, useState } from "react"

type Density = "comoda" | "normale" | "densa"

type ViewPreferences<ColId extends string> = {
  version: number
  visibleCols: ColId[]
  columnWidths: Partial<Record<ColId, number>>
  density: Density
}

type InitialViewPreferences<ColId extends string> = {
  visibleCols: ColId[]
  columnWidths: Partial<Record<ColId, number>>
  density: Density
}

/**
 * Preferenze di visualizzazione tabella (colonne visibili, larghezze,
 * densità) salvate in localStorage per utente, con lo stesso pattern già
 * usato in Lead (che pero' lo aveva scritto inline, non riusabile). Persiste
 * automaticamente ad ogni cambiamento, dopo il primo caricamento.
 */
export function useColumnPreferences<ColId extends string>({
  storageKey,
  validIds,
  defaultVisibleCols,
  defaultDensity = "normale",
  initialPreferences = null,
}: {
  /** Es. `solair:clienti:view:${preferenceOwner}:v1` — includere l'utente per non mischiare preferenze tra account diversi sullo stesso browser. */
  storageKey: string
  validIds: Set<ColId>
  defaultVisibleCols: ColId[]
  defaultDensity?: Density
  initialPreferences?: InitialViewPreferences<ColId> | null
}) {
  const [visibleCols, setVisibleCols] = useState<ColId[]>(
    initialPreferences?.visibleCols ?? defaultVisibleCols,
  )
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColId, number>>>(
    initialPreferences?.columnWidths ?? {},
  )
  const [density, setDensity] = useState<Density>(
    initialPreferences?.density ?? defaultDensity,
  )
  const [preferencesLoaded, setPreferencesLoaded] = useState(
    initialPreferences != null,
  )

  useEffect(() => {
    if (initialPreferences) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) {
          const stored = JSON.parse(raw) as Partial<ViewPreferences<ColId>>
          const order = (stored.visibleCols ?? []).filter((id) => validIds.has(id))
          if (order.length) setVisibleCols(order)
          if (stored.columnWidths) setColumnWidths(stored.columnWidths)
          if (
            stored.density === "comoda" ||
            stored.density === "normale" ||
            stored.density === "densa"
          ) {
            setDensity(stored.density)
          }
        }
      } catch {
        window.localStorage.removeItem(storageKey)
      } finally {
        setPreferencesLoaded(true)
      }
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPreferences, storageKey])

  useEffect(() => {
    if (!preferencesLoaded) return
    const preferences: ViewPreferences<ColId> = {
      version: 1,
      visibleCols,
      columnWidths,
      density,
    }
    window.localStorage.setItem(storageKey, JSON.stringify(preferences))
  }, [columnWidths, density, storageKey, preferencesLoaded, visibleCols])

  function reorderColumns(source: ColId, target: ColId) {
    setVisibleCols((current) => {
      const from = current.indexOf(source)
      const to = current.indexOf(target)
      if (from < 0 || to < 0 || from === to) return current
      const next = [...current]
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }

  return {
    visibleCols,
    setVisibleCols,
    columnWidths,
    setColumnWidths,
    density,
    setDensity,
    reorderColumns,
    preferencesLoaded,
  }
}
