"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import {
  CrmSettingsLauncherProvider,
  useCrmSettingsLauncher,
  type CrmSettingsLayer,
} from "@/lib/crm-settings-launcher"
import { CrmSettingsSidebar } from "@/components/dashboard/crm-settings-sidebar"
import {
  CrmBreadcrumb,
  type CrmBreadcrumbItem,
} from "@/components/dashboard/crm-settings-nav"
import {
  CrmSettingsNavigationProvider,
  CrmSettingsRouteProgress,
  useCrmSettingsNavigation,
} from "@/components/dashboard/crm-settings-navigation"
import {
  CRM_SETTINGS_PAGE_TITLES,
  crmSettingsItemForPath,
} from "@/lib/crm-settings/catalog"

const SECTIONS: Record<string, { label: string; layer: CrmSettingsLayer }> = {
  account: { label: "Account & Security", layer: "account-security" },
  "file-manager": { label: "File Manager", layer: "file-manager" },
  system: { label: "System Settings", layer: "system" },
}

function CrmSettingsHeader() {
  const pathname = usePathname()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const { navigate } = useCrmSettingsNavigation()

  const sectionKey = pathname.split("/").filter(Boolean)[1] ?? ""
  const section = SECTIONS[sectionKey]
  const pageTitle = CRM_SETTINGS_PAGE_TITLES[pathname]
  const catalogItem = crmSettingsItemForPath(pathname)

  const items: CrmBreadcrumbItem[] = [
    { label: "CRM Settings", action: openCrmSettings },
  ]
  if (section) {
    if (pageTitle) {
      items.push({
        label: catalogItem?.section === "organization"
          ? "Organizzazione"
          : catalogItem?.section === "integrations"
            ? "Integrazioni"
            : catalogItem?.section === "infrastructure"
              ? "Infrastruttura"
              : section.label,
        action: () => openCrmSettingsLayer(section.layer),
      })
      items.push({ label: pageTitle })
    } else {
      items.push({ label: section.label })
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between gap-4 px-5">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            Solair
          </span>
          <span className="text-sm font-semibold text-foreground">CRM</span>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <CrmBreadcrumb items={items} />
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          Torna al CRM
        </button>
      </div>

      <div className="flex justify-start border-t border-border px-5 py-2 md:hidden">
        <CrmBreadcrumb items={items} />
      </div>
    </header>
  )
}

export function CrmSettingsShell({ children }: { children: ReactNode }) {
  return (
    <CrmSettingsNavigationProvider>
      <CrmSettingsLauncherProvider>
        <CrmSettingsRouteProgress />
        <div className="flex min-h-screen flex-col bg-muted/30">
          <CrmSettingsHeader />
          <main className="w-full flex-1 px-5 py-6">{children}</main>
        </div>
        <CrmSettingsSidebar />
      </CrmSettingsLauncherProvider>
    </CrmSettingsNavigationProvider>
  )
}
