"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { SYSTEM_SECTION_LINKS } from "@/lib/system-settings-data"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import {
  CrmSettingsNavLink,
  useCrmSettingsNavigation,
} from "@/components/dashboard/crm-settings-navigation"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import {
  CrmBreadcrumb,
  CrmSectionBackLink,
} from "@/components/dashboard/crm-settings-nav"
import { cn } from "@/lib/utils"

export default function SystemSettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const { navigate } = useCrmSettingsNavigation()
  const permissions = usePermissions()
  const currentPage = pageKeyFromPath(pathname)
  const legacyMaintenanceRoutes: Record<string, string> = {
    "/crm-settings/system/make": "/crm-settings/maintenance/make",
    "/crm-settings/system/backup": "/crm-settings/maintenance/backup",
  }
  const maintenanceDestination = legacyMaintenanceRoutes[pathname]
  const canAccessCurrentPage = currentPage ? permissions.canPage(currentPage) : false
  const visibleLinks = SYSTEM_SECTION_LINKS.filter((link) => {
    const page = pageKeyFromPath(link.href)
    return page ? permissions.canPage(page) : true
  })

  useEffect(() => {
    if (maintenanceDestination) {
      navigate(maintenanceDestination, { replace: true })
    } else if (!canAccessCurrentPage) {
      navigate("/", { replace: true })
    }
  }, [canAccessCurrentPage, maintenanceDestination, navigate])

  if (!canAccessCurrentPage || maintenanceDestination) return null

  const current = SYSTEM_SECTION_LINKS.find((l) => l.href === pathname)
  const currentTitle = current?.label ?? "Azienda e sistema"
  const drawerGroup =
    pathname === "/crm-settings/system/comunicazioni"
      ? { label: "Comunicazioni", layer: "communication" as const }
      : [
          "/crm-settings/system/attributi",
          "/crm-settings/system/valori",
          "/crm-settings/system/regole",
          "/crm-settings/system/flussi",
          "/crm-settings/system/import-export",
        ].includes(pathname)
        ? { label: "Configurazione CRM", layer: "crm-config" as const }
        : { label: "Azienda", layer: "company" as const }

  return (
    <div className="flex flex-col gap-5">
      <CrmBreadcrumb
        items={[
          { label: "Solair CRM", action: () => navigate("/") },
          { label: "CRM Settings & Admin", action: openCrmSettings },
          {
            label: drawerGroup.label,
            action: () => openCrmSettingsLayer(drawerGroup.layer),
          },
          { label: currentTitle },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-60 lg:shrink-0">
          <CrmSectionBackLink
            label={drawerGroup.label}
            onClick={() => openCrmSettingsLayer(drawerGroup.layer)}
          />
          <nav
            className="flex flex-col gap-1"
            aria-label="Azienda e sistema"
          >
            {visibleLinks.map((link) => {
              const active = pathname === link.href
              const Icon = link.icon
              return (
                <CrmSettingsNavLink
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-teal bg-navy/5 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  pendingClassName="border-teal bg-navy/5 text-foreground"
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="truncate">{link.label}</span>
                </CrmSettingsNavLink>
              )
            })}
          </nav>
        </aside>

        {/* Area principale */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
