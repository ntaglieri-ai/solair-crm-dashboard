"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Users, Shield, ClipboardList, Lock, type LucideIcon } from "lucide-react"
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

interface SectionLink {
  href: string
  label: string
  icon: LucideIcon
}

const SECTION_LINKS: SectionLink[] = [
  { href: "/crm-settings/account/utenti", label: "Account Management", icon: Users },
  { href: "/crm-settings/account/permessi", label: "Permission Management", icon: Shield },
  { href: "/crm-settings/account/audit", label: "Audit & Log", icon: ClipboardList },
  { href: "/crm-settings/account/session", label: "Session & Access", icon: Lock },
]

const PAGE_TITLE: Record<string, string> = {
  "/crm-settings/account/utenti": "Account Management",
  "/crm-settings/account/permessi": "Permission Management",
  "/crm-settings/account/audit": "Audit & Log",
  "/crm-settings/account/session": "Session & Access",
}

export default function AccountSecurityLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const { navigate } = useCrmSettingsNavigation()
  const permissions = usePermissions()
  const currentPage = pageKeyFromPath(pathname)
  const canAccessCurrentPage = currentPage ? permissions.canPage(currentPage) : false
  const visibleLinks = SECTION_LINKS.filter((link) => {
    const page = pageKeyFromPath(link.href)
    return page ? permissions.canPage(page) : true
  })

  useEffect(() => {
    if (!canAccessCurrentPage) navigate("/", { replace: true })
  }, [canAccessCurrentPage, navigate])

  if (!canAccessCurrentPage) return null

  const currentTitle = PAGE_TITLE[pathname] ?? "Account & Security"

  return (
    <div className="flex flex-col gap-5">
      <CrmBreadcrumb
        items={[
          { label: "Solair CRM", action: () => navigate("/") },
          { label: "CRM Settings & Admin", action: openCrmSettings },
          {
            label: "Account & Security",
            action: () => openCrmSettingsLayer("account-security"),
          },
          { label: currentTitle },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-60 lg:shrink-0">
          <CrmSectionBackLink
            label="Account & Security"
            onClick={() => openCrmSettingsLayer("account-security")}
          />
          <nav className="flex flex-col gap-1" aria-label="Sezioni Account & Security">
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
