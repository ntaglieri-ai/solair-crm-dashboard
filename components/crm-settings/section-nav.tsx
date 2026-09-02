"use client"

import { usePathname } from "next/navigation"
import {
  CRM_SETTINGS_GROUPS,
  crmSettingsItemsForGroup,
  type CrmSettingsGroupId,
} from "@/lib/crm-settings/catalog"
import { useCrmSettingsLauncher } from "@/lib/crm-settings-launcher"
import { CrmSettingsNavLink } from "@/components/dashboard/crm-settings-navigation"
import { CrmSectionBackLink } from "@/components/dashboard/crm-settings-nav"
import { pageKeyFromPath } from "@/lib/permissions/constants"
import { usePermissions } from "@/lib/permissions/provider"
import { cn } from "@/lib/utils"

/**
 * Sidebar di sezione di CRM Settings: unica per tutti i gruppi.
 * Le voci sono quelle del gruppo corrente e solo quelle — non piu' l'intera
 * sezione del catalogo — e il colore lo eredita dal gruppo, non dalla pagina.
 */
export function CrmSettingsSectionNav({ group }: { group: CrmSettingsGroupId }) {
  const pathname = usePathname()
  const permissions = usePermissions()
  const { openCrmSettingsLayer } = useCrmSettingsLauncher()
  const meta = CRM_SETTINGS_GROUPS[group]

  const links = crmSettingsItemsForGroup(group).filter((item) => {
    if (item.superadminOnly && !permissions.isSuperadmin) return false
    const page = pageKeyFromPath(item.href)
    return page ? permissions.canPage(page) : true
  })

  if (links.length === 0) return null

  const activeClasses =
    "bg-white text-foreground shadow-[0_10px_24px_rgb(30_58_95/10%)] ring-1 ring-slate-900/[0.04]"

  return (
    <div className="overflow-hidden rounded-xl border border-white/70 bg-white/82 shadow-[0_18px_45px_rgb(30_58_95/8%)] ring-1 ring-slate-900/[0.03] backdrop-blur">
      <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,#f8fbff_0%,#eef5ff_54%,#f6fffc_100%)] px-3 py-3">
        <CrmSectionBackLink
          label={meta.title}
          onClick={() => openCrmSettingsLayer(group)}
          className="mb-0 border-b-0 pb-0"
        />
      </div>
      <nav className="flex flex-col gap-1 p-2" aria-label={`Sezioni ${meta.title}`}>
        {links.map((link) => {
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
                  ? activeClasses
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground",
              )}
              pendingClassName={activeClasses}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
                  active
                    ? `bg-gradient-to-br ${meta.tone} text-white ${meta.glow}`
                    : meta.soft,
                )}
              >
                <Icon className="size-[17px]" />
              </span>
              <span className="truncate">{link.title}</span>
              {active ? (
                <span
                  className={cn("ml-auto h-7 w-1 rounded-full bg-gradient-to-b", meta.tone)}
                  aria-hidden
                />
              ) : null}
            </CrmSettingsNavLink>
          )
        })}
      </nav>
    </div>
  )
}
