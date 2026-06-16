"use client"

import { useState } from "react"
import {
  IconCalendarEvent,
  IconUser,
  IconPlus,
  IconClipboardList,
} from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { mockCommerciali, type Lead } from "@/lib/mock-data"

type Priority = "Alta" | "Media" | "Bassa"

interface Task {
  id: string
  oggetto: string
  scadenza: string
  assegnato: string
  priorita: Priority
}

const PRIORITY_TONE: Record<Priority, string> = {
  Alta: "bg-destructive/10 text-destructive",
  Media: "bg-warning/10 text-warning",
  Bassa: "bg-muted text-muted-foreground",
}

// Task mock di partenza (specifici per lead caldo/normale)
function initialTasks(lead: Lead): Task[] {
  const base: Task[] = [
    {
      id: "t1",
      oggetto: "Richiamare per conferma preventivo",
      scadenza: "18 Giu 2026",
      assegnato: lead["Lead Proprietario"],
      priorita: lead.Valutazione > 80 ? "Alta" : "Media",
    },
  ]
  if (lead.leadCaldo) {
    base.push({
      id: "t2",
      oggetto: "Inviare scheda tecnica impianto",
      scadenza: "20 Giu 2026",
      assegnato: lead["Lead Proprietario"],
      priorita: "Media",
    })
  }
  return base
}

const PRIORITY_ITEMS: Record<string, string> = {
  Alta: "Alta",
  Media: "Media",
  Bassa: "Bassa",
}

export function LeadTasksCard({ lead }: { lead: Lead }) {
  const [tasks, setTasks] = useState<Task[]>(() => initialTasks(lead))
  const [open, setOpen] = useState(false)
  const [oggetto, setOggetto] = useState("")
  const [scadenza, setScadenza] = useState("")
  const [assegnato, setAssegnato] = useState(lead["Lead Proprietario"])
  const [priorita, setPriorita] = useState<Priority>("Media")

  const ownerItems = Object.fromEntries(mockCommerciali.map((c) => [c, c]))

  const resetForm = () => {
    setOggetto("")
    setScadenza("")
    setAssegnato(lead["Lead Proprietario"])
    setPriorita("Media")
  }

  const addTask = () => {
    if (oggetto.trim() === "") return
    setTasks((prev) => [
      ...prev,
      {
        id: `t${Date.now()}`,
        oggetto: oggetto.trim(),
        scadenza: scadenza || "Da definire",
        assegnato,
        priorita,
      },
    ])
    resetForm()
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClipboardList size={18} stroke={1.8} className="text-navy" />
          Prossime attività
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tasks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {task.oggetto}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      PRIORITY_TONE[task.priorita],
                    )}
                  >
                    {task.priorita}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <IconCalendarEvent size={14} stroke={1.8} />
                    {task.scadenza}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconUser size={14} stroke={1.8} />
                    {task.assegnato}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessun compito pianificato.
          </p>
        )}

        {/* Form aggiungi compito (slide-down) */}
        {open ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/40 p-3 animate-in fade-in slide-in-from-top-1 duration-150">
            <Field>
              <FieldLabel htmlFor="task-oggetto">Oggetto</FieldLabel>
              <Input
                id="task-oggetto"
                value={oggetto}
                onChange={(e) => setOggetto(e.target.value)}
                placeholder="Es. Richiamare il cliente"
                className="bg-card"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="task-scadenza">Scadenza</FieldLabel>
                <Input
                  id="task-scadenza"
                  type="date"
                  value={scadenza}
                  onChange={(e) => setScadenza(e.target.value)}
                  className="bg-card"
                />
              </Field>
              <Field>
                <FieldLabel>Priorità</FieldLabel>
                <Select
                  items={PRIORITY_ITEMS}
                  value={priorita}
                  onValueChange={(v) => setPriorita(v as Priority)}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.keys(PRIORITY_ITEMS).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>Assegnato a</FieldLabel>
              <Select
                items={ownerItems}
                value={assegnato}
                onValueChange={setAssegnato}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {mockCommerciali.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setOpen(false)
                }}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                disabled={oggetto.trim() === ""}
                className="bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={addTask}
              >
                Aggiungi
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full bg-card"
            onClick={() => setOpen(true)}
          >
            <IconPlus size={16} stroke={1.8} data-icon="inline-start" />
            Aggiungi compito
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
