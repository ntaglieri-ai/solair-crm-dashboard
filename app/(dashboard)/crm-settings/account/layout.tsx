"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Users, Shield, ClipboardList, Lock, type LucideIcon } from "lucide-react"
import { CURRENT_USER } from "@/lib/mock-data"
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
  const router = useRouter()
  const isAdmin = CURRENT_USER.ruoloKey === "admin"

  // Accesso riservato agli Admin.
  useEffect(() => {
    if (!isAdmin) router.replace("/")
  }, [isAdmin, router])

  if (!isAdmin) return null

  const currentTitle = PAGE_TITLE[pathname] ?? "Account & Security"

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <span>Solair CRM</span>
        <span aria-hidden>›</span>
        <span>CRM Settings</span>
        <span aria-hidden>›</span>
        <span>Account &amp; Security</span>
        <span aria-hidden>›</span>
        <span className="font-medium text-foreground">{currentTitle}</span>
      </nav>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-60 lg:shrink-0">
          <nav className="flex flex-col gap-1" aria-label="Sezioni Account & Security">
            {SECTION_LINKS.map((link) => {
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
