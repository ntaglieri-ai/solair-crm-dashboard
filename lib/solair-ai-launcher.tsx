"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

interface SolairAiLauncherValue {
  open: boolean
  openSolairAi: () => void
  closeSolairAi: () => void
}

const SolairAiLauncherContext = createContext<SolairAiLauncherValue | null>(null)

export function SolairAiLauncherProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openSolairAi = useCallback(() => setOpen(true), [])
  const closeSolairAi = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, openSolairAi, closeSolairAi }),
    [open, openSolairAi, closeSolairAi],
  )

  return (
    <SolairAiLauncherContext.Provider value={value}>{children}</SolairAiLauncherContext.Provider>
  )
}

export function useSolairAiLauncher() {
  const ctx = useContext(SolairAiLauncherContext)
  if (!ctx) {
    throw new Error("useSolairAiLauncher must be used within a SolairAiLauncherProvider")
  }
  return ctx
}
