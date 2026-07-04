"use client"

import { Check, Loader2, Monitor, Moon, Save, Sun } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/components/providers/appearance-provider"
import type {
  AppearanceAccent,
  AppearanceDensity,
  AppearanceRadius,
  AppearanceTheme,
} from "@/lib/crm-settings/appearance"

export default function AppearancePage() {
  const { preferences, saving, updatePreferences } = useAppearance()

  async function update(
    patch: Partial<typeof preferences>,
  ) {
    const ok = await updatePreferences({ ...preferences, ...patch })
    if (ok) toast.success("Preferenze personali salvate")
    else toast.error("Salvataggio preferenze non riuscito")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Aspetto personale"
        description="Le preferenze sono associate al tuo account e applicate a ogni accesso."
        action={
          saving ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Salvataggio
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-teal">
              <Save className="size-4" />
              Sincronizzato
            </span>
          )
        }
      />

      <SettingsGroup title="Tema">
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["light", "Chiaro", Sun],
            ["dark", "Scuro", Moon],
            ["system", "Sistema", Monitor],
          ] as const).map(([value, label, Icon]) => (
            <Choice
              key={value}
              active={preferences.theme === value}
              label={label}
              icon={<Icon className="size-5" />}
              onClick={() => void update({ theme: value as AppearanceTheme })}
            />
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Colore principale">
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["navy", "Navy", "#1e3a5f"],
            ["teal", "Teal", "#247b67"],
            ["blue", "Blue", "#2563eb"],
          ] as const).map(([value, label, color]) => (
            <Choice
              key={value}
              active={preferences.accent === value}
              label={label}
              icon={<span className="size-5 rounded-full" style={{ backgroundColor: color }} />}
              onClick={() => void update({ accent: value as AppearanceAccent })}
            />
          ))}
        </div>
      </SettingsGroup>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsGroup title="Densità">
          <div className="grid grid-cols-2 gap-3">
            {(["comfortable", "compact"] as AppearanceDensity[]).map((value) => (
              <Choice
                key={value}
                active={preferences.density === value}
                label={value === "comfortable" ? "Comoda" : "Compatta"}
                onClick={() => void update({ density: value })}
              />
            ))}
          </div>
        </SettingsGroup>
        <SettingsGroup title="Stile angoli">
          <div className="grid grid-cols-2 gap-3">
            {(["soft", "compact"] as AppearanceRadius[]).map((value) => (
              <Choice
                key={value}
                active={preferences.radius === value}
                label={value === "soft" ? "Morbido" : "Compatto"}
                onClick={() => void update({ radius: value })}
              />
            ))}
          </div>
        </SettingsGroup>
      </div>
    </div>
  )
}

function SettingsGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Choice({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  icon?: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-16 justify-start gap-3 px-4",
        active && "border-primary bg-primary/5 text-primary",
      )}
    >
      {icon}
      <span>{label}</span>
      {active ? <Check className="ml-auto size-4" /> : null}
    </Button>
  )
}
