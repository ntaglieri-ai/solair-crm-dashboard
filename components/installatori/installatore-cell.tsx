"use client"

import { Bell, StickyNote } from "lucide-react"
import {
  type InstallatoreRecord,
  type InstallatoreColumnId,
} from "@/lib/mock-data"
import { BoolDot } from "@/components/leads/lead-utils"
import {
  installatoreTagColor,
  isLightColor,
} from "@/lib/installatore-tag-store"
import { InstallatoreAvatar, StatoInstallatoreBadge } from "./installatore-utils"

function TagPill({ name }: { name: string }) {
  const color = installatoreTagColor(name)
  const light = isLightColor(color)
  return (
    <span
      className="inline-flex max-w-[160px] min-w-0 items-center py-0.5 pl-2 pr-3.5 text-[11px] font-medium leading-none"
      style={{
        backgroundColor: color,
        color: light ? "#1f2937" : "#ffffff",
        clipPath:
          "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)",
      }}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
  )
}

export function InstallatoreCell({
  installatore,
  column,
  density = "normale",
}: {
  installatore: InstallatoreRecord
  column: InstallatoreColumnId
  density?: "comoda" | "normale" | "densa"
}) {
  const value = installatore[column]

  switch (column) {
    case "Badge dell'attività":
      return installatore["Badge dell'attività"] ? (
        <Bell className="size-4 text-warning" aria-label="Attività in sospeso" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )

    case "Badge di nota":
      return installatore["Badge di nota"] ? (
        <StickyNote className="size-4 text-info" aria-label="Nota presente" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )

    case "Tag":
      return installatore.Tag.length > 0 ? (
        <span className="flex flex-wrap items-center justify-start gap-1">
          {installatore.Tag.map((t) => (
            <TagPill key={t} name={t} />
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )

    case "Nome Installatore":
      return density === "comoda" ? (
        <span className="flex items-center gap-2.5">
          <InstallatoreAvatar
            nome={installatore["Nome Installatore"]}
            className="size-9 text-xs"
          />
          <span className="font-semibold text-foreground">
            {installatore["Nome Installatore"]}
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2.5">
          <InstallatoreAvatar
            nome={installatore["Nome Installatore"]}
            className="size-7 text-[10px]"
          />
          <span className="font-semibold text-foreground">
            {installatore["Nome Installatore"]}
          </span>
        </span>
      )

    case "Stato":
      return <StatoInstallatoreBadge stato={installatore.Stato} />

    case "E-mail":
      return installatore["E-mail"] ? (
        <span className="text-muted-foreground">{installatore["E-mail"]}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
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
      return <span className="text-foreground">{String(value)}</span>
    }
  }
}
