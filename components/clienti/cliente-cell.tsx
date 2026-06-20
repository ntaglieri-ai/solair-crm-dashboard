"use client"

import { Bell, StickyNote } from "lucide-react"
import { type ClienteRecord, type ClienteColumnId } from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
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

  switch (column) {
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
      // Placeholder: la gestione Tag verrà aggiunta in un prompt dedicato.
      return <span className="text-muted-foreground">—</span>

    case "Nome Clienti":
      return density === "comoda" ? (
        <span className="flex items-center gap-2.5">
          <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-9 text-xs" />
          <span className="font-semibold text-foreground">
            {cliente["Nome Clienti"]}
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2.5">
          <ClienteAvatar nome={cliente["Nome Clienti"]} className="size-7 text-[10px]" />
          <span className="font-semibold text-foreground">
            {cliente["Nome Clienti"]}
          </span>
        </span>
      )

    case "Stato":
      return <StatoClienteBadge stato={cliente.Stato} />

    case "E-mail":
      return <span className="text-muted-foreground">{cliente["E-mail"]}</span>

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
