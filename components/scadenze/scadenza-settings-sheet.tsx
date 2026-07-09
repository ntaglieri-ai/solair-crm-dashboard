"use client"

import { IconUsers, IconTag, IconDatabaseCog } from "@tabler/icons-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useScadenzeReferenceData } from "@/lib/scadenze/hooks"
import { ScadenzaAvatar } from "./scadenza-utils"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

export type ScadenzaSettingsSectionId = "proprietari" | "tag" | "amministrazione"

const SECTIONS: {
  id: ScadenzaSettingsSectionId
  label: string
  description: string
  icon: typeof IconUsers
}[] = [
  {
    id: "proprietari",
    label: "Proprietari",
    description: "Utenti attivi che possono possedere una scadenza.",
    icon: IconUsers,
  },
  {
    id: "tag",
    label: "Tag",
    description: "Tag attualmente in uso sulle scadenze (campo libero, sola lettura).",
    icon: IconTag,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti delle Scadenze.",
    icon: IconDatabaseCog,
  },
]

// Elenchi di riferimento in sola lettura: i proprietari vengono da `utenti`,
// i tag sono i valori distinti già presenti in tabella. Nessuna gestione
// colonne/densità qui — il modulo non ne ha (a differenza di Compiti/Lead).
function ProprietariSection() {
  const { data } = useScadenzeReferenceData()
  const proprietari = data?.proprietari ?? []
  if (proprietari.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nessun utente attivo.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {proprietari.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <ScadenzaAvatar nome={p.nome} size={26} />
          <span className="text-sm font-medium text-foreground">{p.nome}</span>
        </div>
      ))}
    </div>
  )
}

function TagSection() {
  const { data } = useScadenzeReferenceData()
  const tags = data?.tags ?? []
  if (tags.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nessun tag assegnato a una scadenza al momento.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-teal/10 px-2.5 py-1 text-xs font-bold text-teal"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

export function ScadenzaSettingsSheet({
  trigger,
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: ScadenzaSettingsSectionId
  onSectionChange: (s: ScadenzaSettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Scadenze</SheetTitle>
          <SheetDescription>Riferimenti e amministrazione del modulo Scadenze.</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1">
          <nav className="w-44 shrink-0 border-r border-border p-2">
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const isActive = s.id === section
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSectionChange(s.id)}
                      className={
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors " +
                        (isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
                      }
                    >
                      <Icon size={17} stroke={1.8} />
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">{active.label}</p>
              <p className="text-xs text-muted-foreground">{active.description}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {section === "proprietari" && <ProprietariSection />}
              {section === "tag" && <TagSection />}
              {section === "amministrazione" && (
                <ModuleGovernanceSection module="scadenze" label="Scadenze" />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
