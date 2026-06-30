"use client"

import Link, { type LinkProps } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

type CrmSettingsNavigationValue = {
  pendingHref: string | null
  navigating: boolean
  navigate: (href: string, options?: { replace?: boolean }) => void
  markNavigating: (href: string) => void
}

const CrmSettingsNavigationContext =
  createContext<CrmSettingsNavigationValue | null>(null)

function pathOnly(href: string) {
  return href.split("?")[0]?.split("#")[0] ?? href
}

export function CrmSettingsNavigationProvider({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const navigating = Boolean(pendingHref && pathOnly(pendingHref) !== pathname)

  const markNavigating = useCallback(
    (href: string) => {
      if (pathOnly(href) !== pathname) setPendingHref(href)
    },
    [pathname],
  )

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (pathOnly(href) === pathname) return
      setPendingHref(href)
      startTransition(() => {
        if (options?.replace) router.replace(href)
        else router.push(href)
      })
    },
    [pathname, router],
  )

  useEffect(() => {
    if (!pendingHref) return
    const timeout = window.setTimeout(() => setPendingHref(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [pendingHref])

  const value = useMemo(
    () => ({
      pendingHref,
      navigating,
      navigate,
      markNavigating,
    }),
    [markNavigating, navigate, navigating, pendingHref],
  )

  return (
    <CrmSettingsNavigationContext.Provider value={value}>
      {children}
    </CrmSettingsNavigationContext.Provider>
  )
}

export function useCrmSettingsNavigation() {
  const ctx = useContext(CrmSettingsNavigationContext)
  const pathname = usePathname()
  const router = useRouter()
  const fallbackMarkNavigating = useCallback(() => {}, [])
  const fallbackNavigate = useCallback(
    (href: string, options?: { replace?: boolean }) => {
      if (pathOnly(href) === pathname) return
      startTransition(() => {
        if (options?.replace) router.replace(href)
        else router.push(href)
      })
    },
    [pathname, router],
  )

  return (
    ctx ?? {
      pendingHref: null,
      navigating: false,
      navigate: fallbackNavigate,
      markNavigating: fallbackMarkNavigating,
    }
  )
}

type CrmSettingsNavLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  keyof LinkProps | "href"
> &
  LinkProps & {
    children: ReactNode
    pendingClassName?: string
  }

export function CrmSettingsNavLink({
  href,
  className,
  pendingClassName,
  onClick,
  onNavigate,
  children,
  prefetch = true,
  ...props
}: CrmSettingsNavLinkProps) {
  const hrefString = typeof href === "string" ? href : href.pathname ?? ""
  const { pendingHref, markNavigating } = useCrmSettingsNavigation()
  const pathname = usePathname()
  const isPending = Boolean(
    hrefString && pendingHref === hrefString && pathOnly(hrefString) !== pathname,
  )

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && hrefString) markNavigating(hrefString)
      }}
      onNavigate={(event) => {
        onNavigate?.(event)
        if (hrefString) markNavigating(hrefString)
      }}
      className={cn(className, isPending && pendingClassName)}
      {...props}
    >
      {children}
    </Link>
  )
}

export function CrmSettingsRouteProgress() {
  const { navigating } = useCrmSettingsNavigation()

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden bg-transparent opacity-0 transition-opacity duration-150",
        navigating && "opacity-100",
      )}
    >
      <div className="h-full w-1/2 animate-[crm-progress_900ms_ease-in-out_infinite] rounded-r-full bg-teal shadow-[0_0_18px_rgba(46,139,114,0.55)]" />
    </div>
  )
}
