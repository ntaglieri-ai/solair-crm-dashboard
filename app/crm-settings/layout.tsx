"use client"

import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import {
  CrmSettingsLauncherProvider,
  useCrmSettingsLauncher,
  type CrmSettingsLayer,
} from "@/lib/crm-settings-launcher"
import { CrmSettingsSidebar } from "@/components/dashboard/crm-settings-sidebar"
import {
  CrmBreadcrumb,
  type CrmBreadcrumbItem,
} from "@/components/dashboard/crm-settings-nav"

/* -------------------------------------------------------------------------- */
/*            Mappe per il breadcrumb dinamico (sezione + pagina)             */
/* -------------------------------------------------------------------------- */

const SECTIONS: Record<string, { label: string; layer: CrmSettingsLayer }> = {
  account: { label: "Account & Security", layer: "account-security" },
  "file-manager": { label: "File Manager", layer: "file-manager" },
  system: { label: "System Settings", layer: "system" },
}

const PAGE_TITLES: Record<string, string> = {
  // Account & Security
  "/crm-settings/account/utenti": "Account Management",
  "/crm-settings/account/permessi": "Permission Management",
  "/crm-settings/account/audit": "Audit & Log",
  "/crm-settings/account/session": "Session & Access",
  // File Manager
  "/crm-settings/file-manager/nextcloud": "Configurazione Nextcloud",
  "/crm-settings/file-manager/struttura": "Struttura cartelle",
  "/crm-settings/file-manager/permessi": "Permessi storage",
  "/crm-settings/file-manager/condivise": "Cartelle condivise",
  // System Settings
  "/crm-settings/system/sedi": "Sedi",
  "/crm-settings/system/attributi": "Attributi record",
  "/crm-settings/system/valori": "Valori configurabili",
  "/crm-settings/system/regole": "Regole di assegnazione",
  "/crm-settings/system/flussi": "Flussi di lavoro",
  "/crm-settings/system/import-export": "Import / Export",
  "/crm-settings/system/make": "Integrazione Make",
  "/crm-settings/system/backup": "Backup",
}

/**
 * Header fisso e dedicato alle pagine CRM Settings: logo a sinistra,
 * breadcrumb dinamico al centro e ritorno al CRM a destra.
 */
function CrmSettingsHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { openCrmSettings, openCrmSettingsLayer } = useCrmSettingsLauncher()

  const sectionKey = pathname.split("/").filter(Boolean)[1] ?? ""
  const section = SECTIONS[sectionKey]
  const pageTitle = PAGE_TITLES[pathname]

  const items: CrmBreadcrumbItem[] = [
    { label: "CRM Settings", action: openCrmSettings },
  ]
  if (section) {
    if (pageTitle) {
      items.push({
        label: section.label,
        action: () => openCrmSettingsLayer(section.layer),
      })
      items.push({ label: pageTitle })
    } else {
      // Indice di sezione: la sezione è la pagina corrente (non cliccabile).
      items.push({ label: section.label })
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center justify-between gap-4 px-5">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            Solair
          </span>
          <span className="text-sm font-semibold text-foreground">CRM</span>
        </div>

        {/* Breadcrumb dinamico */}
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <CrmBreadcrumb items={items} />
        </div>

        {/* Ritorno al CRM */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" />
          Torna al CRM
        </button>
      </div>

      {/* Breadcrumb su riga dedicata nei viewport stretti */}
      <div className="flex justify-start border-t border-border px-5 py-2 md:hidden">
        <CrmBreadcrumb items={items} />
      </div>
    </header>
  )
}

export default function CrmSettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <CrmSettingsLauncherProvider>
      <div className="flex min-h-screen flex-col bg-muted/30">
        <CrmSettingsHeader />
        <main className="w-full flex-1 px-5 py-6">{children}</main>
      </div>
      {/* Overlay di navigazione CRM Settings (aperto dai breadcrumb). */}
      <CrmSettingsSidebar />
    </CrmSettingsLauncherProvider>
  )
}
