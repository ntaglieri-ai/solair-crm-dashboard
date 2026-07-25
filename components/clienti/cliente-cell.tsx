"use client"

import { Bell, StickyNote } from "lucide-react"
import { type ClienteRecord, type ClienteColumnId } from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
import { useClienteTags } from "@/lib/cliente-tag-store"
import { ClienteTagBadges } from "./cliente-tag-controls"
import { QuickContactIcons } from "@/components/shared/quick-contact-icons"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"

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
  const { owners, loading: ownersLoading } = useClienteTags()

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
          {owners.find((owner) => owner.id === value)?.nome || "—"}
        </span>
      )

    case "Badge dell'attività":
      return cliente["Badge dell'attività"] ? (
        <Bell className="size-4 text-warning" aria-label="Attività in sospeso" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )

    case "Badge di nota":
      return cliente["Badge di nota"] ? (
        <StickyNote className="size-4 text-info" aria-label="Nota presente" />
      ) : (
        <span className="text-muted-foreground">—</span>
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
            <span className="truncate font-semibold text-foreground">
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
            <span className="truncate font-semibold text-foreground">
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
