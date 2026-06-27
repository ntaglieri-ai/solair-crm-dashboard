"use client"

import { useState } from "react"
import { Plus, MoreHorizontal, Pencil, Trash2, Zap } from "lucide-react"
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
  workflowsIniziali,
  WORKFLOW_TRIGGER_LABEL,
  type Workflow,
} from "@/lib/system-settings-data"

const TRIGGER_TONE: Record<string, string> = {
  creazione: "bg-teal/10 text-teal",
  modifica: "bg-info/10 text-info",
  data: "bg-warning/10 text-warning",
  manuale: "bg-muted text-muted-foreground",
}

export default function FlussiPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(workflowsIniziali)

  function toggleAttivo(id: string) {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, attivo: !w.attivo } : w)),
    )
  }

  function handleDelete(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Flussi di lavoro"
        description="Configura trigger automatici che si attivano al verificarsi di eventi nel CRM."
        action={
          <Button className="bg-teal text-teal-foreground hover:bg-teal/90">
            <Plus className="size-4" />
            Nuovo flusso
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        {workflows.map((w) => (
          <div
            key={w.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                  <Zap className="size-4" />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-semibold text-foreground">
                    {w.nome}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">
                      {w.modulo}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TRIGGER_TONE[w.trigger]}`}
                    >
                      {WORKFLOW_TRIGGER_LABEL[w.trigger]}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={w.attivo}
                  onCheckedChange={() => toggleAttivo(w.id)}
                  aria-label={`Flusso ${w.nome} attivo`}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Azioni per ${w.nome}`}
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
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDelete(w.id)}
                    >
                      <Trash2 className="size-4" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <ul className="flex flex-col gap-1 pl-12">
              {w.azioni.map((azione, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-teal" />
                  {azione}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
