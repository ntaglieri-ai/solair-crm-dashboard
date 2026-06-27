"use client"

import { useState } from "react"
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  CheckCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import {
  scenariIniziali,
  formatRelativeIt,
  type ScenarioMake,
} from "@/lib/system-settings-data"

type TestState = "idle" | "loading" | "ok"

function ScenarioCard({
  scenario,
  onToggle,
  onDelete,
}: {
  scenario: ScenarioMake
  onToggle: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [testState, setTestState] = useState<TestState>("idle")

  function handleCopy() {
    navigator.clipboard?.writeText(scenario.webhook_url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function handleTest() {
    setTestState("loading")
    window.setTimeout(() => setTestState("ok"), 1200)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold text-foreground">{scenario.nome}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={scenario.attivo}
            onCheckedChange={onToggle}
            aria-label={`Scenario ${scenario.nome} attivo`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Azioni per ${scenario.nome}`}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Modifica
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Webhook URL readonly + copia */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {scenario.webhook_url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copia URL webhook"
        >
          {copied ? (
            <CheckCircle className="size-4 text-teal" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Ultimo trigger:{" "}
          <span className="font-medium text-foreground">
            {formatRelativeIt(scenario.ultimo_trigger)}
          </span>
        </span>
        <div className="flex items-center gap-2">
          {testState === "ok" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
              <CheckCircle className="size-3" />
              OK 200
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testState === "loading"}
          >
            {testState === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Testa webhook
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function MakePage() {
  const [scenari, setScenari] = useState<ScenarioMake[]>(scenariIniziali)

  function toggle(id: string) {
    setScenari((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attivo: !s.attivo } : s)),
    )
  }

  function remove(id: string) {
    setScenari((prev) => prev.filter((s) => s.id !== id))
  }

  function add() {
    setScenari((prev) => [
      ...prev,
      {
        id: `mk_${Date.now()}`,
        nome: "Nuovo scenario",
        webhook_url: `https://hook.eu1.make.com/${Math.random().toString(36).slice(2, 10)}`,
        attivo: false,
        ultimo_trigger: null,
      },
    ])
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Integrazione Make"
        description="Configura i webhook Make.com collegati al CRM."
      />

      <div className="flex flex-col gap-3">
        {scenari.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            onToggle={() => toggle(s.id)}
            onDelete={() => remove(s.id)}
          />
        ))}
      </div>

      <div>
        <Button variant="outline" onClick={add}>
          <Plus className="size-4" />
          Aggiungi scenario
        </Button>
      </div>
    </div>
  )
}
