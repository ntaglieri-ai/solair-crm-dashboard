"use client"

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"
import { buildDefaultPermissionSnapshot } from "./constants"
import { createPermissionEngine } from "./engine"
import type { PermissionEngine, PermissionSnapshot } from "./types"

const PermissionContext = createContext<PermissionEngine | null>(null)

export function PermissionProvider({
  snapshot,
  children,
}: {
  snapshot: PermissionSnapshot
  children: ReactNode
}) {
  const engine = useMemo(() => createPermissionEngine(snapshot), [snapshot])
  return (
    <PermissionContext.Provider value={engine}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const value = useContext(PermissionContext)
  return (
    value ??
    createPermissionEngine(
      buildDefaultPermissionSnapshot({
        ruoloCode: "STANDARD",
        ruoloNome: "Permessi non caricati",
      }),
    )
  )
}
