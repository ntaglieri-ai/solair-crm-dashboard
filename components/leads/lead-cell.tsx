"use client"

import { useState } from "react"
import { Bell, Loader2, StickyNote } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
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
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import { MentionText } from "@/components/shared/note-mentions"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fetchLeadSignalDetails, leadsKeys } from "@/lib/leads/hooks"

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
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function FriendlyDateTime({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value.trim()) {
    return <span className="text-muted-foreground">—</span>
  }
  const formatted = formatMoment(value)
  return (
    <span className="whitespace-nowrap tabular-nums text-foreground" title={value}>
      {formatted}
    </span>
  )
}

function EmptySignalIcon({
  icon: Icon,
  label,
}: {
  icon: typeof Bell
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/35"
            aria-label={label}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function NoteIcons({ lead }: { lead: Lead }) {
  const preloadedNotes = lead.noteItems ?? []
  const hasNotes = Boolean(lead["Badge di nota"]) || preloadedNotes.length > 0

  if (!hasNotes) {
    return <EmptySignalIcon icon={StickyNote} label="Nessuna nota" />
  }

  return <LeadNotesPopover lead={lead} />
}

function LeadNotesPopover({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false)
  const preloadedNotes = lead.noteItems ?? []
  const preloadedTasks = lead.taskItems ?? []
  const { data, isFetching, isError } = useQuery({
    queryKey: leadsKeys.signals(lead.id),
    queryFn: ({ signal }) => fetchLeadSignalDetails(lead.id, signal),
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    initialData:
      preloadedNotes.length > 0 || preloadedTasks.length > 0
        ? { notes: preloadedNotes, tasks: preloadedTasks }
        : undefined,
  })
  const notes = data?.notes ?? preloadedNotes

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Apri note"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 transition-transform hover:-translate-y-0.5"
          >
            <StickyNote className="size-4" />
          </button>
        }
      />
      <PopoverContent
        align="center"
        className="max-h-80 w-80 overflow-y-auto p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 font-bold text-emerald-700">
          {isFetching && notes.length === 0 ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <StickyNote className="size-5" />
          )}
          Note
        </div>
        {isError ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Dettagli non disponibili.
          </p>
        ) : isFetching && notes.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Caricamento...
          </p>
        ) : notes.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Nessuna nota.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {notes.map((note, index) => {
              const color = NOTE_COLORS[index % NOTE_COLORS.length]
              return (
                <article
                  key={note.id}
                  className="rounded-lg p-3"
                  style={{ background: color.paper }}
                >
                  <MentionText text={note.text} mentions={note.menzioni} className="text-sm leading-5 text-foreground" />
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {formatMoment(note.createdAt)}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function TaskIcons({ lead }: { lead: Lead }) {
  const preloadedTasks = lead.taskItems ?? []
  const hasTasks = Boolean(lead["Badge dell'attività"]) || preloadedTasks.length > 0

  if (!hasTasks) {
    return <EmptySignalIcon icon={Bell} label="Nessuna attività" />
  }

  return <LeadTasksPopover lead={lead} />
}

function LeadTasksPopover({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false)
  const preloadedNotes = lead.noteItems ?? []
  const preloadedTasks = lead.taskItems ?? []
  const { data, isFetching, isError } = useQuery({
    queryKey: leadsKeys.signals(lead.id),
    queryFn: ({ signal }) => fetchLeadSignalDetails(lead.id, signal),
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    initialData:
      preloadedNotes.length > 0 || preloadedTasks.length > 0
        ? { notes: preloadedNotes, tasks: preloadedTasks }
        : undefined,
  })
  const tasks = data?.tasks ?? preloadedTasks

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Apri attività"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex size-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 transition-transform hover:-translate-y-0.5"
          >
            <Bell className="size-4" />
          </button>
        }
      />
      <PopoverContent
        align="center"
        className="max-h-80 w-80 overflow-y-auto p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 font-bold text-blue-700">
          {isFetching && tasks.length === 0 ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Bell className="size-5" />
          )}
          Attività
        </div>
        {isError ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Dettagli non disponibili.
          </p>
        ) : isFetching && tasks.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Caricamento...
          </p>
        ) : tasks.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Nessuna attività.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-bold text-foreground">{task.title}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-muted px-2.5 py-2">
                    {task.priority}
                  </span>
                  <span className="rounded-md bg-muted px-2.5 py-2">
                    {task.status}
                  </span>
                </div>
                {task.dueDate ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    Scadenza: {formatMoment(task.dueDate)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
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
  const { ownerNames, loading } = useTags()
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
        <span className="flex min-w-0 items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <LeadAvatar nome={lead["Nome Lead"]} className="size-9 text-xs" />
            <span className="truncate font-semibold text-foreground">{lead["Nome Lead"]}</span>
          </span>
          <QuickContactIcons
            kind="lead"
            recordId={lead.id}
            nome={lead["Nome Lead"]}
            telefono={lead.Telefono}
            email={lead["E-mail"]}
          />
        </span>
      ) : (
        <span className="flex min-w-0 items-center justify-between gap-2.5">
          <span className="truncate font-semibold text-foreground">{lead["Nome Lead"]}</span>
          <QuickContactIcons
            kind="lead"
            recordId={lead.id}
            nome={lead["Nome Lead"]}
            telefono={lead.Telefono}
            email={lead["E-mail"]}
          />
        </span>
      )

    case "Telefono":
      return (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-foreground">{lead.Telefono || "—"}</span>
          <QuickContactIcons
            kind="lead"
            recordId={lead.id}
            nome={lead["Nome Lead"]}
            telefono={lead.Telefono}
            email={lead["E-mail"]}
            show={["phone", "whatsapp"]}
          />
        </span>
      )

    case "E-mail":
      return (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-muted-foreground">{lead["E-mail"] || "—"}</span>
          <QuickContactIcons
            kind="lead"
            recordId={lead.id}
            nome={lead["Nome Lead"]}
            telefono={lead.Telefono}
            email={lead["E-mail"]}
            show={["email"]}
          />
        </span>
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
          {typeof value === "string" && value
            ? ownerNames[value] ?? "Utente non disponibile"
            : "—"}
        </span>
      )

    case "kWp":
      return <span className="tabular-nums text-foreground">{lead.kWp}</span>

    case "kWh":
      return <span className="tabular-nums text-foreground">{lead.kWh}</span>

    case "Data Click":
    case "Ora creazione":
    case "Ora ultima attività":
    case "Data/Ora":
      return <FriendlyDateTime value={value} />

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
