"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SunMedium } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  NAV_PRINCIPALE,
  NAV_GESTIONE,
  NAV_ADMIN,
  CURRENT_USER,
  type NavItem,
} from "@/lib/mock-data"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { NAV_ICONS } from "./icons"

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.icon]
  const pathname = usePathname()
  const active = isActive(item.href, pathname)
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <Badge
          className={cn(
            "h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] tabular-nums",
            item.badge.tone === "destructive"
              ? "bg-destructive text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.badge.count}
        </Badge>
      ) : null}
    </Link>
  )
}

function NavLauncherButton({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.icon]
  const { openLauncher } = useCrmSettingsLauncher()
  return (
    <button
      type="button"
      onClick={openLauncher}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 truncate text-left">{item.label}</span>
    </button>
  )
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {items.map((item) => (
        <NavLink key={item.label} item={item} />
      ))}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-navy-foreground">
          <SunMedium className="size-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-foreground">Solair CRM</span>
          <span className="text-xs text-muted-foreground">solairgroup.it</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        <NavSection title="Principale" items={NAV_PRINCIPALE} />
        <NavSection title="Gestione" items={NAV_GESTIONE} />

        {/* CRM Settings: solo admin, separata dalle voci operative */}
        {CURRENT_USER.ruoloKey === "admin" ? (
          <div className="mt-auto border-t border-sidebar-border pt-4">
            <NavLauncherButton item={NAV_ADMIN} />
          </div>
        ) : null}
      </nav>

      {/* Footer utente */}
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-navy-foreground">
          {CURRENT_USER.iniziali}
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">
            {CURRENT_USER.nome}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {CURRENT_USER.ruolo}
          </span>
        </div>
      </div>
    </aside>
  )
}
