"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { CrmSettingsLayer } from "@/lib/crm-settings/catalog"

export type { CrmSettingsLayer } from "@/lib/crm-settings/catalog"

interface CrmSettingsLauncherValue {
  open: boolean
  layer: CrmSettingsLayer
  setOpen: (open: boolean) => void
  setLayer: (layer: CrmSettingsLayer) => void
  /** Apre il pannello sul Layer 1 (root). */
  openCrmSettings: () => void
  /** Apre il pannello direttamente su un Layer 2. */
  openCrmSettingsLayer: (layer: CrmSettingsLayer) => void
  /** Chiude il pannello. */
  closeCrmSettings: () => void
  /** Alias retro-compatibili. */
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
  const [layer, setLayer] = useState<CrmSettingsLayer>("root")

  const openCrmSettings = useCallback(() => {
    setLayer("root")
    setOpen(true)
  }, [])

  const openCrmSettingsLayer = useCallback((next: CrmSettingsLayer) => {
    setLayer(next)
    setOpen(true)
  }, [])

  const closeCrmSettings = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({
      open,
      layer,
      setOpen,
      setLayer,
      openCrmSettings,
      openCrmSettingsLayer,
      closeCrmSettings,
      // Alias retro-compatibili usati dai componenti esistenti.
      openLauncher: openCrmSettings,
      closeLauncher: closeCrmSettings,
    }),
    [open, layer, openCrmSettings, openCrmSettingsLayer, closeCrmSettings],
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
