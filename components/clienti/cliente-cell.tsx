"use client"

import { Bell, StickyNote } from "lucide-react"
import { type ClienteRecord, type ClienteColumnId } from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { ClienteTagBadges } from "./cliente-tag-controls"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"
import { displayClienteOwner } from "@/lib/clienti/owner-display"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
        <span className="flex max-w-[460px] flex-wrap items-center justify-center gap-1.5">
          <ClienteTagBadges clienteId={cliente.id} max={3} />
        </span>
      )

    case "Nome Clienti":
      return density === "comoda" ? (
        <span className="flex min-w-0 items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-9 text-xs" />
            <span className="line-clamp-2 break-words font-semibold text-foreground">
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
        <span className="flex min-w-0 items-center justify-between gap-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-7 text-[10px]" />
            <span className="line-clamp-2 break-words font-semibold text-foreground">
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
