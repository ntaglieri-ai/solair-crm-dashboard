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

// Colonne con allineamento a destra (valori numerici)
export const NUMERIC_COLUMNS: LeadColumnId[] = ["Valutazione", "kWp", "kWh"]

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
      return lead["Badge dell'attività"] ? (
        <Bell className="size-4 text-warning" aria-label="Attività in sospeso" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )

    case "Badge di nota":
      return lead["Badge di nota"] ? (
        <StickyNote className="size-4 text-info" aria-label="Nota presente" />
      ) : (
        <span className="text-muted-foreground">—</span>
      )

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
