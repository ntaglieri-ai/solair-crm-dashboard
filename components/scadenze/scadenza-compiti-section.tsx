"use client"

import { useState } from "react"
import { IconChecklist, IconPlus } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type Compito, type ClienteCompito, OPEN_TASK_STATI } from "@/lib/mock-data"
import { QuickCompitoDialog } from "@/components/compiti/quick-compito-dialog"

/**
 * Isola client per la sezione "Compiti collegati" della scheda Scadenza —
 * la pagina resta un server component, questo componente gestisce solo
 * lista + dialog di creazione rapida (stesso pattern di lead-detail-content
 * e cliente-detail-content).
 */
export function ScadenzaCompitiSection({
  scadenzaId,
  scadenzaNome,
  initialCompiti,
}: {
  scadenzaId: string
  scadenzaNome: string
  initialCompiti: ClienteCompito[]
}) {
  const [tasks, setTasks] = useState(initialCompiti)
  const [tab, setTab] = useState<"aperte" | "chiuse">("aperte")
  const [dialogOpen, setDialogOpen] = useState(false)

  const aperte = tasks.filter((t) => OPEN_TASK_STATI.includes(t.stato))
  const chiuse = tasks.filter((t) => !OPEN_TASK_STATI.includes(t.stato))
  const list = tab === "aperte" ? aperte : chiuse

  const handleCreated = (compito: Compito) => {
    setTasks((prev) => [
      {
        id: compito.id,
        oggetto: compito.Oggetto,
        scadenza: compito["Data di scadenza"],
        priorita: compito.Priorità,
        assegnato: compito["Proprietario del compito"],
        stato: compito.Stato,
      },
      ...prev,
    ])
  }

  return (
    <section className="flex flex-col gap-3 border-b border-border py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconChecklist size={16} stroke={1.8} className="text-navy" />
          Compiti collegati
        </h2>
        <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
          <IconPlus size={14} stroke={1.8} data-icon="inline-start" />
          Compito
        </Button>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-card p-0.5">
        {(["aperte", "chiuse"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
              tab === t
                ? "bg-navy text-navy-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {list.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Nessuna attività {tab === "aperte" ? "aperta" : "chiusa"}.
          </li>
        ) : null}
        {list.map((t) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
              tab === "chiuse" && "opacity-60",
            )}
          >
            <span
              className={cn(
                "truncate text-sm font-medium text-foreground",
                tab === "chiuse" && "line-through",
              )}
            >
              {t.oggetto}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t.scadenza || "Da pianificare"} · {t.assegnato}
            </span>
          </li>
        ))}
      </ul>

      <QuickCompitoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        correlato={{ tipo: "scadenza", id: scadenzaId, nome: scadenzaNome }}
        onCreated={handleCreated}
      />
    </section>
  )
}
