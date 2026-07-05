"use client"

import { useState } from "react"
import {
  IconProgress,
  IconFlag,
  IconBellRinging,
  IconAdjustmentsHorizontal,
  IconDatabaseCog,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  STATO_COMPITO_ORDER,
  PRIORITA_COMPITO_ORDER,
  STATO_COMPITO_TONE,
  PRIORITA_COMPITO_TONE,
} from "@/lib/mock-data"
import { ModuleGovernanceSection } from "@/components/crm-settings/module-governance-section"

export type CompitoSettingsSectionId =
  | "stati"
  | "priorita"
  | "promemoria"
  | "generali"
  | "amministrazione"

const SECTIONS: {
  id: CompitoSettingsSectionId
  label: string
  description: string
  icon: typeof IconProgress
}[] = [
  {
    id: "stati",
    label: "Stati",
    description: "Gestisci gli stati del flusso di lavoro dei compiti.",
    icon: IconProgress,
  },
  {
    id: "priorita",
    label: "Priorità",
    description: "Definisci i livelli di priorità disponibili.",
    icon: IconFlag,
  },
  {
    id: "promemoria",
    label: "Promemoria",
    description: "Configura notifiche e promemoria automatici.",
    icon: IconBellRinging,
  },
  {
    id: "generali",
    label: "Generali",
    description: "Preferenze di visualizzazione dell'elenco compiti.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    id: "amministrazione",
    label: "Amministrazione",
    description: "Campi, valori, automazioni e trasferimenti dei Compiti.",
    icon: IconDatabaseCog,
  },
]

function StatiSection() {
  return (
    <div className="flex flex-col gap-2">
      {STATO_COMPITO_ORDER.map((s) => (
        <div
          key={s}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              STATO_COMPITO_TONE[s],
            )}
          >
            {s}
          </span>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Rinomina
          </Button>
        </div>
      ))}
    </div>
  )
}

function PrioritaSection() {
  return (
    <div className="flex flex-col gap-2">
      {PRIORITA_COMPITO_ORDER.map((p) => (
        <div
          key={p}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
        >
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              PRIORITA_COMPITO_TONE[p],
            )}
          >
            {p}
          </span>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Modifica colore
          </Button>
        </div>
      ))}
    </div>
  )
}

function PromemoriaSection() {
  const [email, setEmail] = useState(true)
  const [push, setPush] = useState(false)
  const [anticipo, setAnticipo] = useState("30")
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Notifiche email
          </span>
          <span className="text-xs text-muted-foreground">
            Ricevi un&apos;email all&apos;avvicinarsi della scadenza.
          </span>
        </span>
        <Switch checked={email} onCheckedChange={setEmail} />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Notifiche push
          </span>
          <span className="text-xs text-muted-foreground">
            Avvisi nel browser per i compiti in scadenza.
          </span>
        </span>
        <Switch checked={push} onCheckedChange={setPush} />
      </label>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Anticipo promemoria
          </span>
          <span className="text-xs text-muted-foreground">
            Minuti prima della scadenza.
          </span>
        </span>
        <Input
          type="number"
          value={anticipo}
          onChange={(e) => setAnticipo(e.target.value)}
          className="w-24 bg-card"
        />
      </div>
    </div>
  )
}

function GeneraliSection() {
  const [raggruppa, setRaggruppa] = useState(true)
  const [scaduti, setScaduti] = useState(true)
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Raggruppa per stato
          </span>
          <span className="text-xs text-muted-foreground">
            Nella vista lista, raggruppa i compiti per stato.
          </span>
        </span>
        <Switch checked={raggruppa} onCheckedChange={setRaggruppa} />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            Evidenzia scaduti
          </span>
          <span className="text-xs text-muted-foreground">
            Mostra in rosso i compiti oltre la data di scadenza.
          </span>
        </span>
        <Switch checked={scaduti} onCheckedChange={setScaduti} />
      </label>
    </div>
  )
}

export function CompitoSettingsSheet({
  trigger,
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: CompitoSettingsSectionId
  onSectionChange: (s: CompitoSettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Compiti</SheetTitle>
          <SheetDescription>
            Personalizza stati, priorità e promemoria dei compiti.
          </SheetDescription>
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
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
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
              <p className="text-sm font-semibold text-foreground">
                {active.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {active.description}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {section === "stati" && <StatiSection />}
              {section === "priorita" && <PrioritaSection />}
              {section === "promemoria" && <PromemoriaSection />}
              {section === "generali" && <GeneraliSection />}
              {section === "amministrazione" && (
                <ModuleGovernanceSection module="compiti" label="Compiti" />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
