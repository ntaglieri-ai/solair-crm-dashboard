"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { SYSTEM_SECTION_LINKS } from "@/lib/system-settings-data"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
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
  const router = useRouter()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const permissions = usePermissions()
  const currentPage = pageKeyFromPath(pathname)
  const canAccessCurrentPage = currentPage ? permissions.canPage(currentPage) : false
  const visibleLinks = SYSTEM_SECTION_LINKS.filter((link) => {
    const page = pageKeyFromPath(link.href)
    return page ? permissions.canPage(page) : true
  })

  useEffect(() => {
    if (!canAccessCurrentPage) router.replace("/")
  }, [canAccessCurrentPage, router])

  if (!canAccessCurrentPage) return null

  const current = SYSTEM_SECTION_LINKS.find((l) => l.href === pathname)
  const currentTitle = current?.label ?? "System Settings"

  return (
    <div className="flex flex-col gap-5">
      <CrmBreadcrumb
        items={[
          { label: "Solair CRM", action: () => router.push("/") },
          { label: "CRM Settings", action: openCrmSettings },
          {
            label: "System Settings",
            action: () => openCrmSettingsLayer("system"),
          },
          { label: currentTitle },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-60 lg:shrink-0">
          <CrmSectionBackLink
            label="System Settings"
            onClick={() => openCrmSettingsLayer("system")}
          />
          <nav
            className="flex flex-col gap-1"
            aria-label="Sezioni System Settings"
          >
            {visibleLinks.map((link) => {
              const active = pathname === link.href
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-teal bg-navy/5 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="truncate">{link.label}</span>
                </Link>
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
