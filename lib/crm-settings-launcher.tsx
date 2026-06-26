"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

interface CrmSettingsLauncherValue {
  open: boolean
  setOpen: (open: boolean) => void
  openLauncher: () => void
  closeLauncher: () => void
}

const CrmSettingsLauncherContext =
  createContext<CrmSettingsLauncherValue | null>(null)

export function CrmSettingsLauncherProvider({
  children,
}: {
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  const openLauncher = useCallback(() => setOpen(true), [])
  const closeLauncher = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, setOpen, openLauncher, closeLauncher }),
    [open, openLauncher, closeLauncher],
  )

  return (
    <CrmSettingsLauncherContext.Provider value={value}>
      {children}
    </CrmSettingsLauncherContext.Provider>
  )
}

export function useCrmSettingsLauncher() {
  const ctx = useContext(CrmSettingsLauncherContext)
  if (!ctx) {
    throw new Error(
      "useCrmSettingsLauncher must be used within a CrmSettingsLauncherProvider",
    )
  }
  return ctx
}
