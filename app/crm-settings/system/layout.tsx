"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useCrmSettingsNavigation } from "@/components/dashboard/crm-settings-navigation"
import { CrmSettingsSectionShell } from "@/components/crm-settings/section-shell"

/**
 * Le due pagine tecniche sono state spostate sotto /maintenance: qui restano
 * solo i vecchi indirizzi, che rimandano alla destinazione attuale.
 */
const LEGACY_MAINTENANCE_ROUTES: Record<string, string> = {
  "/crm-settings/system/make": "/crm-settings/maintenance/make",
  "/crm-settings/system/backup": "/crm-settings/maintenance/backup",
}

export default function SystemSettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const { navigate } = useCrmSettingsNavigation()
  const maintenanceDestination = LEGACY_MAINTENANCE_ROUTES[pathname]

  useEffect(() => {
    if (maintenanceDestination) navigate(maintenanceDestination, { replace: true })
  }, [maintenanceDestination, navigate])

  if (maintenanceDestination) return null

  return <CrmSettingsSectionShell>{children}</CrmSettingsSectionShell>
}
