"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { CRM_SETTINGS_CATALOG } from "@/lib/crm-settings/catalog"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { usePermissions } from "@/lib/permissions/provider"
import {
  CrmSettingsNavLink,
  useCrmSettingsNavigation,
} from "@/components/dashboard/crm-settings-navigation"
import {
  CrmBreadcrumb,
  CrmSectionBackLink,
} from "@/components/dashboard/crm-settings-nav"
import { cn } from "@/lib/utils"

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const permissions = usePermissions()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const { navigate } = useCrmSettingsNavigation()
  const allowed = permissions.isSuperadmin
  const links = CRM_SETTINGS_CATALOG.filter(
    (item) => item.section === "maintenance",
  )
  const current = links.find((item) => item.href === pathname)
  const drawerGroup =
    pathname === "/crm-settings/maintenance/make" ||
    pathname === "/crm-settings/maintenance/file-manager"
      ? { label: "Integrazioni", layer: "integrations" as const }
      : { label: "Manutenzione", layer: "maintenance" as const }

  useEffect(() => {
    if (!allowed) navigate("/", { replace: true })
  }, [allowed, navigate])

  if (!allowed) return null

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
          { label: current?.title ?? "Manutenzione" },
        ]}
      />
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <CrmSectionBackLink
            label={drawerGroup.label}
            onClick={() => openCrmSettingsLayer(drawerGroup.layer)}
          />
          <nav className="flex flex-col gap-1" aria-label="Manutenzione">
            {links.map((link) => {
              const Icon = link.icon
              const active = pathname === link.href
              return (
                <CrmSettingsNavLink
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium",
                    active
                      ? "border-teal bg-navy/5 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="truncate">{link.title}</span>
                </CrmSettingsNavLink>
              )
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
