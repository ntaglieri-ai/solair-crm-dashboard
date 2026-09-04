"use client"

import { Bell, StickyNote, Plus } from "lucide-react"
import { type ClienteRecord, type ClienteColumnId } from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { ClienteTagBadges, ClienteTagAssignPopover } from "./cliente-tag-controls"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { displayClienteOwner } from "@/lib/clienti/owner-display"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const CLIENTE_DATE_COLUMNS = new Set<ClienteColumnId>([
  "Ora modifica",
  "Ora creazione",
  "Ora ultima attività",
  "Ora iscrizione annullata",
  "Visita più recente",
  "Prima visita",
  "Data Fatt/Pagamento",
  "Data installazione ultimata",
  "Data appuntamento allaccio",
  "Data ammissibilità",
  "Data sopralluogo",
  "Data affidamento sopralluogo",
  "Data conferma Iter E-distribuzione",
  "Data scadenza TICA",
  "Data iter Enel Concluso",
  "Data interlocutorio",
  "Data Click",
])

const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const IT_DATE_RE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i

function isValidDatePart(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function parseClienteDate(value: string) {
  const trimmed = value.trim()
  const isoDateOnlyMatch = ISO_DATE_ONLY_RE.exec(trimmed)
  if (isoDateOnlyMatch) {
    const [, yearValue, monthValue, dayValue] = isoDateOnlyMatch
    const year = Number(yearValue)
    const month = Number(monthValue)
    const day = Number(dayValue)
    if (isValidDatePart(year, month, day)) {
      return { date: new Date(year, month - 1, day), hasTime: false }
    }
  }

  const itDateMatch = IT_DATE_RE.exec(trimmed)
  if (itDateMatch) {
    const [, dayValue, monthValue, yearValue, hourValue, minuteValue, secondValue, meridiem] =
      itDateMatch
    const year = Number(yearValue)
    const month = Number(monthValue)
    const day = Number(dayValue)
    const hasTime = hourValue !== undefined && minuteValue !== undefined
    let hour = hasTime ? Number(hourValue) : 0
    const minute = hasTime ? Number(minuteValue) : 0
    const second = secondValue ? Number(secondValue) : 0

    if (meridiem) {
      const marker = meridiem.toUpperCase()
      if (marker === "AM" && hour === 12) hour = 0
      if (marker === "PM" && hour < 12) hour += 12
    }

    const isValidTime =
      !hasTime ||
      (hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59 &&
        second >= 0 &&
        second <= 59)

    if (isValidDatePart(year, month, day) && isValidTime) {
      return {
        date: new Date(year, month - 1, day, hour, minute, second),
        hasTime,
      }
    }
  }

  const fallbackDate = new Date(trimmed)
  if (Number.isNaN(fallbackDate.getTime())) return null

  return {
    date: fallbackDate,
    hasTime: /(?:T|\s)\d{1,2}:\d{2}/.test(trimmed),
  }
}

function formatClienteMoment(value: string) {
  const parsed = parseClienteDate(value)
  if (!parsed) return value

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    ...(parsed.hasTime ? { timeStyle: "short" as const } : {}),
  }).format(parsed.date)
}

function FriendlyDateTime({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value.trim()) {
    return <span className="text-muted-foreground">—</span>
  }
  const formatted = formatClienteMoment(value)
  return (
    <span className="whitespace-nowrap tabular-nums text-foreground" title={value}>
      {formatted}
    </span>
  )
}

function SignalIcon({
  icon: Icon,
  label,
  active,
  activeClassName,
}: {
  icon: typeof Bell
  label: string
  active: boolean
  activeClassName: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={
              active
                ? `inline-flex size-7 items-center justify-center rounded-md ${activeClassName}`
                : "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/35"
            }
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

export function ClienteCell({
  cliente,
  column,
  density = "normale",
}: {
  cliente: ClienteRecord
  column: ClienteColumnId
  density?: "comoda" | "normale" | "densa"
}) {
  const value = cliente[column]
  const { ownerNames, loading: ownersLoading } = useClienteTags()

  switch (column) {
    case "Clienti Proprietario":
      if (ownersLoading) {
        return (
          <span
            aria-label="Caricamento proprietario"
            className="block h-4 w-28 animate-pulse rounded bg-muted"
          />
        )
      }
      return (
        <span className="text-foreground">
          {displayClienteOwner(cliente, ownerNames, "—")}
        </span>
      )

    case "Badge dell'attività":
      return (
        <SignalIcon
          icon={Bell}
          active={Boolean(cliente["Badge dell'attività"])}
          activeClassName="bg-warning/15 text-warning ring-1 ring-inset ring-warning/20"
          label={
            cliente["Badge dell'attività"]
              ? "Attività in sospeso"
              : "Nessuna attività"
          }
        />
      )

    case "Badge di nota":
      return (
        <SignalIcon
          icon={StickyNote}
          active={Boolean(cliente["Badge di nota"])}
          activeClassName="bg-info/15 text-info ring-1 ring-inset ring-info/20"
          label={cliente["Badge di nota"] ? "Nota presente" : "Nessuna nota"}
        />
      )

    case "Tag":
      return (
        <span
          className="flex max-w-[460px] flex-wrap items-center justify-center gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          <ClienteTagBadges clienteId={cliente.id} max={3} />
          <ClienteTagAssignPopover
            clienteId={cliente.id}
            trigger={
              <button
                type="button"
                aria-label="Aggiungi tag"
                className="flex size-4 shrink-0 items-center justify-center rounded border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                <Plus size={10} strokeWidth={2} />
              </button>
            }
          />
        </span>
      )

    case "Nome Clienti":
      return density === "comoda" ? (
        <span className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2.5">
          <span className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
            <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-9 text-xs" />
            <span className="min-w-0 whitespace-normal font-semibold text-foreground [overflow-wrap:anywhere]">
              {cliente["Nome Clienti"]}
            </span>
          </span>
          <QuickContactIcons
            kind="cliente"
            recordId={cliente.id}
            nome={cliente["Nome Clienti"]}
            telefono={cliente.Cellulare}
            email={cliente["E-mail"]}
          />
        </span>
      ) : (
        <span className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2.5">
          <span className="flex min-w-0 flex-1 basis-40 items-center gap-2.5">
            <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-7 text-[10px]" />
            <span className="min-w-0 whitespace-normal font-semibold text-foreground [overflow-wrap:anywhere]">
              {cliente["Nome Clienti"]}
            </span>
          </span>
          <QuickContactIcons
            kind="cliente"
            recordId={cliente.id}
            nome={cliente["Nome Clienti"]}
            telefono={cliente.Cellulare}
            email={cliente["E-mail"]}
          />
        </span>
      )

    case "Stato":
      return <StatoClienteBadge stato={cliente.Stato} />

    case "Cellulare":
      return (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-foreground">{cliente.Cellulare || "—"}</span>
          <QuickContactIcons
            kind="cliente"
            recordId={cliente.id}
            nome={cliente["Nome Clienti"]}
            telefono={cliente.Cellulare}
            email={cliente["E-mail"]}
            show={["phone", "whatsapp"]}
          />
        </span>
      )

    case "E-mail":
      return (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-muted-foreground">{cliente["E-mail"] || "—"}</span>
          <QuickContactIcons
            kind="cliente"
            recordId={cliente.id}
            nome={cliente["Nome Clienti"]}
            telefono={cliente.Cellulare}
            email={cliente["E-mail"]}
            show={["email"]}
          />
        </span>
      )

    default: {
      if (CLIENTE_DATE_COLUMNS.has(column)) {
        return <FriendlyDateTime value={value} />
      }
      if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground">—</span>
      }
      if (typeof value === "boolean") {
        return <BoolDot value={value} />
      }
      if (Array.isArray(value)) {
        return value.length > 0 ? (
          <span className="text-foreground">{value.join(", ")}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      }
      if (typeof value === "number") {
        return (
          <span className="tabular-nums text-foreground">
            {value.toLocaleString("it-IT")}
          </span>
        )
      }
      return <span className="text-foreground">{String(value)}</span>
    }
  }
}
