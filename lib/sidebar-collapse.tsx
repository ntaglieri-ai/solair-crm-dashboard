"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const STORAGE_KEY = "crm-sidebar-collapsed"
export const SIDEBAR_WIDTH_EXPANDED = "248px"
export const SIDEBAR_WIDTH_COLLAPSED = "76px"

type SidebarCollapseContextValue = {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  toggle: () => void
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null)

/**
 * Stato "sidebar compressa" condiviso tra la sidebar stessa e il resto del
 * layout (padding del contenuto, barra di progresso navigazione, drawer)
 * che vivono in componenti diversi. La larghezza corrente e' esposta anche
 * come CSS var sull'elemento <html>, cosi' chi ha bisogno solo del valore
 * per uno stile (non della logica del toggle) non deve consumare il
 * context — evita di dover risalire l'albero componenti per un dettaglio
 * di layout.
 */
export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "1") setCollapsedState(true)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0")
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
    )
  }, [collapsed, hydrated])

  function setCollapsed(value: boolean) {
    setCollapsedState(value)
  }

  return (
    <SidebarCollapseContext.Provider
      value={{ collapsed, setCollapsed, toggle: () => setCollapsedState((v) => !v) }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  )
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext)
  if (!ctx) {
    throw new Error("useSidebarCollapse va usato dentro <SidebarCollapseProvider>")
  }
  return ctx
}
