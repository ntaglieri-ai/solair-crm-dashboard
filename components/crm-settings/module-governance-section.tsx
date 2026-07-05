"use client"

import { useRouter } from "next/navigation"
import {
  ArrowLeftRight,
  ChevronRight,
  GitBranch,
  ListFilter,
  Settings2,
  Workflow,
} from "lucide-react"
import { usePermissions } from "@/lib/permissions/provider"

const ITEMS = [
  {
    id: "fields",
    label: "Campi e struttura",
    description: "Colonne, tipi, obbligatorietà e visibilità",
    route: "/crm-settings/system/attributi",
    action: "fields.view",
    icon: Settings2,
  },
  {
    id: "values",
    label: "Valori e stati",
    description: "Opzioni ammesse per stati e campi configurabili",
    route: "/crm-settings/system/valori",
    action: "default_values.manage",
    icon: ListFilter,
  },
  {
    id: "assignment",
    label: "Regole di assegnazione",
    description: "Criteri automatici specifici del modulo",
    route: "/crm-settings/system/regole",
    action: "assignment_rules.manage",
    icon: GitBranch,
  },
  {
    id: "workflows",
    label: "Flussi di lavoro",
    description: "Trigger e azioni eseguiti sugli eventi del modulo",
    route: "/crm-settings/system/flussi",
    action: "workflows.manage",
    icon: Workflow,
  },
  {
    id: "transfer",
    label: "Importa ed esporta",
    description: "Trasferimenti dati limitati a questo modulo",
    route: "/crm-settings/system/import-export",
    action: "import",
    icon: ArrowLeftRight,
  },
] as const

export function ModuleGovernanceSection({
  module,
  label,
}: {
  module: "lead" | "clienti" | "compiti" | "scadenze" | "installatori"
  label: string
}) {
  const router = useRouter()
  const permissions = usePermissions()
  const visibleItems = ITEMS.filter((item) => {
    if (item.action === "import") {
      return permissions.canRecord(module, "import")
    }
    return permissions.canAction(`${module}.${item.action}`)
  })

  if (visibleItems.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Il tuo ruolo non gestisce la configurazione di {label.toLowerCase()}.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {visibleItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              router.push(`${item.route}?module=${encodeURIComponent(label)}`)
            }
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )
      })}
    </div>
  )
}
