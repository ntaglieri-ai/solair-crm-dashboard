import type { ReactNode } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { CrmSettingsSidebar } from "@/components/dashboard/crm-settings-sidebar"
import { CrmSettingsLauncherProvider } from "@/lib/crm-settings-launcher"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { PermissionProvider } from "@/lib/permissions/provider"
import { PageTransition } from "@/components/motion/page-transition"
import { NavigationFeedback } from "@/components/navigation/navigation-feedback"
import { SessionTimeoutGuard } from "@/components/auth/session-timeout-guard"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const permissions = await loadCurrentPermissionSnapshot()

  return (
    <PermissionProvider snapshot={permissions}>
      <CrmSettingsLauncherProvider>
        <div className="min-h-screen bg-background">
          <SessionTimeoutGuard />
          <Sidebar />
          <NavigationFeedback />
          <div className="flex min-h-screen min-w-0 flex-col pt-20 lg:pl-[248px] lg:pt-0">
            <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-7">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </div>
        <CrmSettingsSidebar />
      </CrmSettingsLauncherProvider>
    </PermissionProvider>
  )
}
