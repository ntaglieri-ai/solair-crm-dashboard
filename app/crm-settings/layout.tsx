import type { ReactNode } from "react"
import { CrmSettingsShell } from "./crm-settings-shell"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { PermissionProvider } from "@/lib/permissions/provider"

export default async function CrmSettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  const permissions = await loadCurrentPermissionSnapshot()

  return (
    <PermissionProvider snapshot={permissions}>
      <CrmSettingsShell>{children}</CrmSettingsShell>
    </PermissionProvider>
  )
}
