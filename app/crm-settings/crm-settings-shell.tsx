"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
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
  account: { label: "Account e accessi", layer: "account-security" },
  maintenance: { label: "Manutenzione", layer: "maintenance" },
  "file-manager": { label: "Integrazioni", layer: "integrations" },
  system: { label: "Azienda", layer: "company" },
}

function settingsGroupForItem(item: ReturnType<typeof crmSettingsItemForPath> | undefined) {
  if (!item) return null
  if (["company", "sites", "appearance"].includes(item.id)) {
    return { label: "Azienda", layer: "company" as CrmSettingsLayer }
  }
  if (item.id === "communication") {
    return { label: "Comunicazioni", layer: "communication" as CrmSettingsLayer }
  }
  if (["attributes", "default-values", "assignment-rules", "workflows", "import-export"].includes(item.id)) {
    return { label: "Configurazione CRM", layer: "crm-config" as CrmSettingsLayer }
  }
  if (["make", "nextcloud"].includes(item.id)) {
    return { label: "Integrazioni", layer: "integrations" as CrmSettingsLayer }
  }
  if (["health", "backup"].includes(item.id)) {
    return { label: "Manutenzione", layer: "maintenance" as CrmSettingsLayer }
  }
  return null
}

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

  const sectionKey = pathname.split("/").filter(Boolean)[1] ?? ""
  const section = SECTIONS[sectionKey]
  const pageTitle = CRM_SETTINGS_PAGE_TITLES[pathname]
  const catalogItem = crmSettingsItemForPath(pathname)
  const settingsGroup = settingsGroupForItem(catalogItem)

  const items: CrmBreadcrumbItem[] = [
    { label: "CRM Settings & Admin", action: openCrmSettings },
  ]
  if (section) {
    if (pageTitle) {
      items.push({
        label: settingsGroup?.label ?? section.label,
        action: () => openCrmSettingsLayer(settingsGroup?.layer ?? section.layer),
      })
      items.push({ label: pageTitle })
    } else {
      items.push({ label: section.label })
    }
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
