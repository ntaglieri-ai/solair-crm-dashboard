import type { ReactNode } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { CrmSettingsSidebar } from "@/components/dashboard/crm-settings-sidebar"
import { CrmSettingsLauncherProvider } from "@/lib/crm-settings-launcher"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { PermissionProvider } from "@/lib/permissions/provider"
import { PageTransition } from "@/components/motion/page-transition"
import { NavigationFeedback } from "@/components/navigation/navigation-feedback"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const permissions = await loadCurrentPermissionSnapshot()

  return (
    <PermissionProvider snapshot={permissions}>
      <CrmSettingsLauncherProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <NavigationFeedback />
          <div className="flex min-h-screen flex-col lg:pl-[248px]">
            <main className="flex-1 px-5 py-6 lg:px-8 lg:py-7">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </div>
        <CrmSettingsSidebar />
      </CrmSettingsLauncherProvider>
    </PermissionProvider>
  )
}
