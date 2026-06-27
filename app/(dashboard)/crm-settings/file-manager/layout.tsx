"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Cloud,
  FolderTree,
  ShieldCheck,
  FolderOpen,
  type LucideIcon,
} from "lucide-react"
import { CURRENT_USER } from "@/lib/mock-data"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
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
  { href: "/crm-settings/file-manager/nextcloud", label: "Configurazione Nextcloud", icon: Cloud },
  { href: "/crm-settings/file-manager/struttura", label: "Struttura cartelle", icon: FolderTree },
  { href: "/crm-settings/file-manager/permessi", label: "Permessi storage", icon: ShieldCheck },
  { href: "/crm-settings/file-manager/condivise", label: "Cartelle condivise", icon: FolderOpen },
]

const PAGE_TITLE: Record<string, string> = {
  "/crm-settings/file-manager/nextcloud": "Configurazione Nextcloud",
  "/crm-settings/file-manager/struttura": "Struttura cartelle",
  "/crm-settings/file-manager/permessi": "Permessi storage",
  "/crm-settings/file-manager/condivise": "Cartelle condivise",
}

export default function FileManagerLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()
  const isAdmin = CURRENT_USER.ruoloKey === "admin"

  // Accesso riservato agli Admin / Superadmin.
  useEffect(() => {
    if (!isAdmin) router.replace("/")
  }, [isAdmin, router])

  if (!isAdmin) return null

  const currentTitle = PAGE_TITLE[pathname] ?? "File Manager"

  return (
    <div className="flex flex-col gap-5">
      <CrmBreadcrumb
        items={[
          { label: "Solair CRM", action: () => router.push("/") },
          { label: "CRM Settings", action: openCrmSettings },
          {
            label: "File Manager",
            action: () => openCrmSettingsLayer("file-manager"),
          },
          { label: currentTitle },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar di sezione */}
        <aside className="lg:w-60 lg:shrink-0">
          <CrmSectionBackLink
            label="File Manager"
            onClick={() => openCrmSettingsLayer("file-manager")}
          />
          <nav className="flex flex-col gap-1" aria-label="Sezioni File Manager">
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
