"use client"

import { Bell, StickyNote } from "lucide-react"
import {
  type Lead,
  type LeadColumnId,
} from "@/lib/mock-data"
import {
  StatoLeadBadge,
  OrigineBadge,
  EmailStatoBadge,
  ScoreBar,
  BoolDot,
  LeadAvatar,
} from "./lead-utils"
import { LeadTagBadges } from "./tag-controls"
import { useTags } from "@/lib/tag-store"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Colonne con allineamento a destra (valori numerici)
export const NUMERIC_COLUMNS: LeadColumnId[] = ["Valutazione", "kWp", "kWh"]

const NOTE_COLORS = [
  { bg: "#dcfce7", fg: "#15803d", paper: "#f0fdf4" },
  { bg: "#dbeafe", fg: "#2563eb", paper: "#eff6ff" },
  { bg: "#fef3c7", fg: "#b45309", paper: "#fffbeb" },
  { bg: "#f3e8ff", fg: "#7e22ce", paper: "#faf5ff" },
  { bg: "#ffe4e6", fg: "#be123c", paper: "#fff1f2" },
]

function formatMoment(value: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function NoteIcons({ lead }: { lead: Lead }) {
  const notes = lead.noteItems ?? []
  if (notes.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex max-w-full flex-wrap justify-center gap-1.5">
      {notes.map((note, index) => {
        const color = NOTE_COLORS[index % NOTE_COLORS.length]
        return (
          <Popover key={note.id}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={`Apri nota ${index + 1}`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex size-8 items-center justify-center rounded-md transition-transform hover:-translate-y-0.5"
                  style={{ background: color.bg, color: color.fg }}
                >
                  <StickyNote className="size-4" />
                </button>
              }
            />
            <PopoverContent
              align="center"
              className="w-72 border-0 p-5 shadow-xl"
              style={{ background: color.paper }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center gap-2 font-bold" style={{ color: color.fg }}>
                <StickyNote className="size-5" />
                Nota
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-6 text-foreground">
                {note.text}
              </p>
              <p className="mt-4 text-xs font-medium text-muted-foreground">
                {formatMoment(note.createdAt)}
              </p>
            </PopoverContent>
          </Popover>
        )
      })}
    </span>
  )
}

function TaskIcons({ lead }: { lead: Lead }) {
  const tasks = lead.taskItems ?? []
  if (tasks.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex max-w-full flex-wrap justify-center gap-1.5">
      {tasks.map((task, index) => {
        const color = NOTE_COLORS[(index + 1) % NOTE_COLORS.length]
        return (
          <Popover key={task.id}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={`Apri attività ${index + 1}`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex size-8 items-center justify-center rounded-md transition-transform hover:-translate-y-0.5"
                  style={{ background: color.bg, color: color.fg }}
                >
                  <Bell className="size-4" />
                </button>
              }
            />
            <PopoverContent
              align="center"
              className="w-72 gap-3 p-4 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 font-bold" style={{ color: color.fg }}>
                <Bell className="size-5" />
                Attività
              </div>
              <p className="text-[15px] font-bold text-foreground">{task.title}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-md bg-muted px-2.5 py-2">
                  {task.priority}
                </span>
                <span className="rounded-md bg-muted px-2.5 py-2">
                  {task.status}
                </span>
              </div>
              {task.dueDate ? (
                <p className="text-xs font-medium text-muted-foreground">
                  Scadenza: {formatMoment(task.dueDate)}
                </p>
              ) : null}
            </PopoverContent>
          </Popover>
        )
      })}
    </span>
  )
}

export function LeadCell({
  lead,
  column,
  density = "normale",
}: {
  lead: Lead
  column: LeadColumnId
  density?: "comoda" | "normale" | "densa"
}) {
  const { owners, loading } = useTags()
  const value = lead[column]

  switch (column) {
    case "Badge dell'attività":
      return <TaskIcons lead={lead} />

    case "Badge di nota":
      return <NoteIcons lead={lead} />

    case "Tag":
      return <LeadTagBadges leadId={lead.id} max={3} />

    case "Nome Lead":
      return density === "comoda" ? (
        <span className="flex items-center gap-2.5">
          <LeadAvatar nome={lead["Nome Lead"]} className="size-9 text-xs" />
          <span className="font-semibold text-foreground">{lead["Nome Lead"]}</span>
        </span>
      ) : (
        <span className="font-semibold text-foreground">{lead["Nome Lead"]}</span>
      )

    case "Stato Lead":
      return <StatoLeadBadge stato={lead["Stato Lead"]} />

    case "Origine Lead":
      return <OrigineBadge origine={lead["Origine Lead"]} />

    case "Stato":
      return <EmailStatoBadge stato={lead.Stato} />

    case "Valutazione":
      return <ScoreBar score={lead.Valutazione} />

    case "Residente in Sicilia":
      return <BoolDot value={lead["Residente in Sicilia"]} />

    case "E-mail":
      return (
        <span className="text-muted-foreground">{lead["E-mail"]}</span>
      )

    case "Lead Proprietario":
      if (loading) {
        return (
          <span
            aria-label="Caricamento proprietario"
            className="block h-4 w-28 animate-pulse rounded bg-muted"
          />
        )
      }
      return (
        <span className="text-foreground">
          {owners.find((owner) => owner.id === value)?.nome || "—"}
        </span>
      )

    case "kWp":
      return <span className="tabular-nums text-foreground">{lead.kWp}</span>

    case "kWh":
      return <span className="tabular-nums text-foreground">{lead.kWh}</span>

    default: {
      if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground">—</span>
      }
      if (typeof value === "boolean") {
        return <BoolDot value={value} />
      }
      return <span className="text-foreground">{String(value)}</span>
    }
  }
}
