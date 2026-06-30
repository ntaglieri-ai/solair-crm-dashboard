import type { ReactNode } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import { CrmSettingsSidebar } from "@/components/dashboard/crm-settings-sidebar"
import { TagProvider } from "@/lib/tag-store"
import { CrmSettingsLauncherProvider } from "@/lib/crm-settings-launcher"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { PermissionProvider } from "@/lib/permissions/provider"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const permissions = await loadCurrentPermissionSnapshot()

  return (
    <PermissionProvider snapshot={permissions}>
      <CrmSettingsLauncherProvider>
        <TagProvider>
          <div className="min-h-screen bg-background">
            <Sidebar />
            <div className="flex min-h-screen flex-col lg:pl-[228px]">
              <Topbar />
              <main className="flex-1 px-5 py-6">{children}</main>
            </div>
          </div>
          <CrmSettingsSidebar />
        </TagProvider>
      </CrmSettingsLauncherProvider>
    </PermissionProvider>
  )
}
