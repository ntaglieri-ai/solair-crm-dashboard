"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

interface SolairAiChatLauncherValue {
  open: boolean
  openChat: () => void
  closeChat: () => void
}

const SolairAiChatLauncherContext = createContext<SolairAiChatLauncherValue | null>(null)

export function SolairAiChatLauncherProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openChat = useCallback(() => setOpen(true), [])
  const closeChat = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ open, openChat, closeChat }), [open, openChat, closeChat])

  return (
    <SolairAiChatLauncherContext.Provider value={value}>
      {children}
    </SolairAiChatLauncherContext.Provider>
  )
}

export function useSolairAiChatLauncher() {
  const ctx = useContext(SolairAiChatLauncherContext)
  if (!ctx) {
    throw new Error("useSolairAiChatLauncher must be used within a SolairAiChatLauncherProvider")
  }
  return ctx
}
