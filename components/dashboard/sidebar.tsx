"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { SunMedium, User, Settings, LogOut, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NAV_PRINCIPALE,
  NAV_GESTIONE,
  NAV_ADMIN,
  type NavItem,
} from "@/lib/navigation"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import { NAV_ICONS } from "./icons"
import { motion } from "framer-motion"

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.icon]
  const pathname = usePathname()
  const active = isActive(item.href, pathname)
  return (
    <motion.div whileHover={{ x: 3 }} transition={{ duration: 0.18 }}>
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
    </motion.div>
  )
}

function NavLauncherButton({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.icon]
  const { openCrmSettings, open } = useCrmSettingsLauncher()
  return (
    <button
      type="button"
      onClick={openCrmSettings}
      aria-current={open ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
        open
          ? "border-teal bg-navy/5 text-foreground"
          : "border-transparent text-sidebar-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 truncate text-left">{item.label}</span>
    </button>
  )
}

function ProfileMenu() {
  const router = useRouter()
  const permissions = usePermissions()
  const subject = permissions.snapshot.subject

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignora errori di rete: procediamo comunque al redirect
    }
    router.push("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-3 border-t border-sidebar-border px-4 py-4 text-left outline-none transition-colors",
          "hover:bg-muted focus-visible:bg-muted",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-navy-foreground">
          {subject.iniziali}
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-foreground">
            {subject.nome}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {subject.ruoloNome}
            {subject.sede ? ` · ${subject.sede}` : ""}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--anchor-width) min-w-56"
      >
        <DropdownMenuItem render={<Link href="/profilo" />}>
          <User className="size-4" />
          Profilo
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/impostazioni" />}>
          <Settings className="size-4" />
          Impostazioni
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const permissions = usePermissions()
  const visiblePrincipale = NAV_PRINCIPALE.filter((item) => {
    const page = pageKeyFromPath(item.href)
    return page ? permissions.canPage(page) : true
  })
  const visibleGestione = NAV_GESTIONE.filter((item) => {
    const page = pageKeyFromPath(item.href)
    return page ? permissions.canPage(page) : true
  })
  const canOpenCrmSettings =
    permissions.canPage("crm_settings") ||
    permissions.canAction("company.profile.view")

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground shadow-[0_8px_24px_rgba(30,58,95,.2)]">
          <SunMedium className="size-6" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[17px] font-extrabold text-foreground">Solair CRM</span>
          <span className="text-xs text-muted-foreground">solairgroup.it</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
        {visiblePrincipale.length > 0 ? (
          <NavSection title="Principale" items={visiblePrincipale} />
        ) : null}
        {visibleGestione.length > 0 ? (
          <NavSection title="Gestione" items={visibleGestione} />
        ) : null}

        {canOpenCrmSettings ? (
          <div className="mt-auto border-t border-sidebar-border pt-4">
            <NavLauncherButton item={NAV_ADMIN} />
          </div>
        ) : null}
      </nav>

      {/* Footer utente */}
      <ProfileMenu />
    </aside>
  )
}
