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
import { useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

export type InstallatoreSettingsSectionId = "proprietari" | "tag" | "amministrazione"

const SECTIONS: {
  id: InstallatoreSettingsSectionId
  label: string
  description: string
  icon: typeof IconUsers
}[] = [
  {
    id: "proprietari",
    label: "Proprietari",
    description: "Utenti attivi che possono possedere un installatore.",
    icon: IconUsers,
  },
  {
    id: "tag",
    label: "Tag",
    description: "Tag attualmente in uso sugli installatori (campo libero, sola lettura).",
    icon: IconTag,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti degli Installatori.",
    icon: IconDatabaseCog,
  },
]

function initials(nome: string): string {
  return nome
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// Elenchi di riferimento in sola lettura: i proprietari vengono da `utenti`,
// i tag sono i valori distinti già presenti in tabella. Nessuna gestione
// colonne/densità qui — il modulo non ne ha (a differenza di Compiti/Lead).
function ProprietariSection() {
  const { data } = useInstallatoriReferenceData()
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
          <span
            className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-secondary text-[9.5px] font-semibold text-foreground"
            aria-hidden="true"
          >
            {initials(p.nome)}
          </span>
          <span className="text-sm font-medium text-foreground">{p.nome}</span>
        </div>
      ))}
    </div>
  )
}

function TagSection() {
  const { data } = useInstallatoriReferenceData()
  const tags = data?.tags ?? []
  if (tags.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nessun tag assegnato a un installatore al momento.
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

export function InstallatoreSettingsSheet({
  trigger,
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: InstallatoreSettingsSectionId
  onSectionChange: (s: InstallatoreSettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Installatori</SheetTitle>
          <SheetDescription>Riferimenti e amministrazione del modulo Installatori.</SheetDescription>
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
                <ModuleGovernanceSection module="installatori" label="Installatori" />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
