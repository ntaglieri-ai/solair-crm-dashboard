import type { ReactNode } from "react"
import { CrmSettingsSectionShell } from "@/components/crm-settings/section-shell"

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return (
    <CrmSettingsSectionShell requireSuperadmin>{children}</CrmSettingsSectionShell>
  )
}
