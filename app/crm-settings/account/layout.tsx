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
  tone: string
}

const SECTION_LINKS: SectionLink[] = [
  {
    href: "/crm-settings/account/utenti",
    label: "Account Management",
    icon: Users,
    tone: "from-[#0176d3] to-[#2e8bff]",
  },
  {
    href: "/crm-settings/account/permessi",
    label: "Permission Management",
    icon: Shield,
    tone: "from-[#6f42c1] to-[#9f7aea]",
  },
  {
    href: "/crm-settings/account/audit",
    label: "Audit & Log",
    icon: ClipboardList,
    tone: "from-[#dd7a01] to-[#f5b041]",
  },
  {
    href: "/crm-settings/account/session",
    label: "Session & Access",
    icon: Lock,
    tone: "from-[#2e8b72] to-[#35b79a]",
  },
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
            label: "Admin & Sicurezza",
            action: () => openCrmSettingsLayer("account-security"),
          },
          { label: currentTitle },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-[0_18px_45px_rgb(30_58_95/8%)] ring-1 ring-slate-900/[0.03] backdrop-blur">
            <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_54%,#f6fffc_100%)] px-3 py-3">
              <CrmSectionBackLink
                label="Admin & Sicurezza"
                onClick={() => openCrmSettingsLayer("account-security")}
              />
            </div>
            <nav className="flex flex-col gap-1 p-2" aria-label="Sezioni Admin & Sicurezza">
              {visibleLinks.map((link) => {
                const active = pathname === link.href
                const Icon = link.icon
                return (
                  <CrmSettingsNavLink
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-semibold transition-all",
                      active
                        ? "bg-white text-foreground shadow-[0_10px_24px_rgb(30_58_95/10%)] ring-1 ring-slate-900/[0.04]"
                        : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
                    )}
                    pendingClassName="bg-white text-foreground shadow-[0_10px_24px_rgb(30_58_95/10%)] ring-1 ring-slate-900/[0.04]"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-all group-hover:bg-white",
                        active &&
                          `bg-gradient-to-br ${link.tone} text-white shadow-[0_8px_18px_rgb(1_118_211/22%)]`,
                      )}
                    >
                      <Icon className="size-[17px]" />
                    </span>
                    <span className="truncate">{link.label}</span>
                    {active ? (
                      <span
                        className={cn("ml-auto h-7 w-1 rounded-full bg-gradient-to-b", link.tone)}
                        aria-hidden
                      />
                    ) : null}
                  </CrmSettingsNavLink>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Area principale */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
