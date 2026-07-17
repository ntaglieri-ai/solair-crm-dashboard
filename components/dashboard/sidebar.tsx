"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { User, Settings, LogOut, ChevronsUpDown } from "lucide-react"
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

const OGGI = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date())

const DEFAULT_COMPANY_LOGO = "/solair-brand-logo.png"

function normalizedLogoUrl(value?: string) {
  if (!value || value.endsWith("/solair-group-logo.png")) return DEFAULT_COMPANY_LOGO
  return value
}

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.icon]
  const pathname = usePathname()
  const router = useRouter()
  const active = isActive(item.href, pathname)
  return (
    <motion.div whileHover={{ x: 3 }} transition={{ duration: 0.18 }}>
    <Link
      href={item.href}
      onMouseEnter={() => router.prefetch(item.href)}
      onFocus={() => router.prefetch(item.href)}
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
  const [companyLogo, setCompanyLogo] = useState(DEFAULT_COMPANY_LOGO)
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

  useEffect(() => {
    if (!permissions.canAction("company.profile.view")) return
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
  }, [permissions])

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      {/* Logo */}
      <div className="border-b border-sidebar-border px-5 py-5">
        <Link
          href="https://www.solairgroup.it"
          className="flex justify-center rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Apri il sito Solair Group"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="flex h-20 w-40 items-center justify-start overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companyLogo}
              alt="Solair CRM"
              className="h-16 w-36 object-contain object-left"
            />
          </div>
        </Link>
        <p className="mt-3 text-[15px] font-bold capitalize leading-5 text-primary">
          {OGGI}
        </p>
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
