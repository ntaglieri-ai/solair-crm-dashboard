"use client"

import {
  IconUserPlus,
  IconPhoneCall,
  IconFileInvoice,
  IconUserOff,
  IconFlame,
  type Icon,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { LeadStats } from "@/lib/leads/api-types"

type Tone = "info" | "warning" | "navy" | "muted" | "destructive"

const TONE_CLASS: Record<Tone, string> = {
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  navy: "bg-navy/10 text-navy",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
}

function KpiCard({
  label,
  value,
  icon: KpiIcon,
  tone,
}: {
  label: string
  value: number | undefined
  icon: Icon
  tone: Tone
}) {
  // Fallback elegante quando il valore non è ancora disponibile.
  const display = typeof value === "number" ? value.toLocaleString("it-IT") : "—"
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          TONE_CLASS[tone],
        )}
      >
        <KpiIcon size={18} stroke={1.8} />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {display}
        </span>
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function LeadKpis({ stats }: { stats?: LeadStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="Nuovi oggi"
        value={stats?.nuoviOggi}
        icon={IconUserPlus}
        tone="info"
      />
      <KpiCard
        label="Da richiamare"
        value={stats?.byStato?.["Tentato di contattare"] ?? 0}
        icon={IconPhoneCall}
        tone="warning"
      />
      <KpiCard
        label="Preventivi inviati"
        value={stats?.byStato?.["Inviato Preventivo"] ?? 0}
        icon={IconFileInvoice}
        tone="navy"
      />
      <KpiCard
        label="Non assegnati"
        value={stats?.nonAssegnati}
        icon={IconUserOff}
        tone="muted"
      />
      <KpiCard
        label="Lead caldi"
        value={stats?.caldi}
        icon={IconFlame}
        tone="destructive"
      />
    </div>
  )
}
