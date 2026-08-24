"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { crmSettingsGroupForPath } from "@/lib/crm-settings/catalog"
import { useCrmSettingsNavigation } from "@/components/dashboard/crm-settings-navigation"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import { CrmSettingsSectionNav } from "@/components/crm-settings/section-nav"

/**
 * Impaginazione condivisa delle sezioni di CRM Settings: sidebar del gruppo
 * a cui la pagina appartiene secondo il catalogo, piu' l'area principale.
 * Il breadcrumb sta solo nella testata della shell, cosi' resta uno.
 */
export function CrmSettingsSectionShell({
  children,
  requireSuperadmin = false,
}: {
  children: ReactNode
  /** Sezioni tecniche: l'accesso non passa per i permessi di pagina. */
  requireSuperadmin?: boolean
}) {
  const pathname = usePathname()
  const permissions = usePermissions()
  const { navigate } = useCrmSettingsNavigation()
  const group = crmSettingsGroupForPath(pathname)
  const currentPage = pageKeyFromPath(pathname)
  const allowed = requireSuperadmin
    ? permissions.isSuperadmin
    : currentPage
      ? permissions.canPage(currentPage)
      : false

  useEffect(() => {
    if (!allowed) navigate("/", { replace: true })
  }, [allowed, navigate])

  if (!allowed) return null

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {group ? (
        <aside className="lg:w-64 lg:shrink-0">
          <CrmSettingsSectionNav group={group.id} />
        </aside>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
