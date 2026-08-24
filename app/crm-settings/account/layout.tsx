import type { ReactNode } from "react"
import { CrmSettingsSectionShell } from "@/components/crm-settings/section-shell"

export default function AccountSecurityLayout({
  children,
}: {
  children: ReactNode
}) {
  return <CrmSettingsSectionShell>{children}</CrmSettingsSectionShell>
}
