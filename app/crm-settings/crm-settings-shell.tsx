"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import {
  CrmSettingsLauncherProvider,
  useCrmSettingsLauncher,
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
import { crmSettingsGroupForPath, crmSettingsItemForPath } from "@/lib/crm-settings/catalog"

const DEFAULT_COMPANY_LOGO = "/solair-brand-logo.png"

function normalizedLogoUrl(value?: string) {
  if (!value || value.endsWith("/solair-group-logo.png")) return DEFAULT_COMPANY_LOGO
  return value
}

function CrmSettingsHeader() {
  const pathname = usePathname()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const { navigate } = useCrmSettingsNavigation()
  const [companyLogo, setCompanyLogo] = useState(DEFAULT_COMPANY_LOGO)

  // Unico breadcrumb dell'area: gruppo e titolo vengono dal catalogo, gli
  // stessi che la sidebar di sezione usa per le voci.
  const catalogItem = crmSettingsItemForPath(pathname)
  const group = crmSettingsGroupForPath(pathname)

  const items: CrmBreadcrumbItem[] = [
    { label: "CRM Settings & Admin", action: openCrmSettings },
  ]
  if (group) {
    items.push({
      label: group.title,
      action: () => openCrmSettingsLayer(group.id),
    })
  }
  if (catalogItem) {
    items.push({ label: catalogItem.title })
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/crm-settings/system/company.profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { value?: { logoUrl?: string } } | null) => {
        if (!cancelled) setCompanyLogo(normalizedLogoUrl(payload?.value?.logoUrl))
      })
      .catch(() => {
        /* fallback locale */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between gap-4 px-5">
        <div className="flex h-12 w-28 shrink-0 items-center justify-start overflow-hidden" aria-label="Solair Group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={companyLogo} alt="Solair CRM" className="h-10 w-24 object-contain object-left" />
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
