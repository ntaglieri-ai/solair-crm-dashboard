"use client"

import { Bell, StickyNote } from "lucide-react"
import { type ClienteRecord, type ClienteColumnId } from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
import { clienteTagColor, isLightColor } from "@/lib/cliente-tag-store"
import { ClienteAvatar, StatoClienteBadge } from "./cliente-utils"

function ClienteTagPill({ name }: { name: string }) {
  const color = clienteTagColor(name)
  const light = isLightColor(color)

  return (
    <span
      className="inline-flex max-w-[180px] min-w-0 items-center py-1 pl-2.5 pr-4 text-xs font-semibold leading-none shadow-sm"
      style={{
        backgroundColor: color,
        color: light ? "#172033" : "#ffffff",
        clipPath:
          "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)",
      }}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
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
      return cliente.Tag.length > 0 ? (
        <span className="flex max-w-[460px] flex-wrap items-center justify-center gap-1.5">
          {cliente.Tag.slice(0, 3).map((tag) => (
            <ClienteTagPill key={tag} name={tag} />
          ))}
          {cliente.Tag.length > 3 ? (
            <span
              className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
              title={cliente.Tag.slice(3).join(", ")}
            >
              +{cliente.Tag.length - 3}
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )

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
