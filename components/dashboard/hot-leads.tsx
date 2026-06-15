import { Flame } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  type Lead,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
} from "@/lib/mock-data"
import { ItalyMap } from "./italy-map"

const STATUS_STYLES = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
  teal: "bg-teal/10 text-teal",
  destructive: "bg-destructive/10 text-destructive",
} as const

const AVATAR_COLORS = [
  "bg-navy text-navy-foreground",
  "bg-teal text-teal-foreground",
  "bg-info text-info-foreground",
  "bg-warning text-warning-foreground",
  "bg-destructive text-destructive-foreground",
]

function initials(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function scoreColor(score: number) {
  if (score > 80) return "var(--success)"
  if (score >= 50) return "var(--warning)"
  return "var(--chart-5)"
}

function LeadRow({ lead, index }: { lead: Lead; index: number }) {
  const tone = LEAD_STATUS_TONE[lead.status]
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          AVATAR_COLORS[index % AVATAR_COLORS.length],
        )}
      >
        {initials(lead.nome)}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">
          {lead.nome}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {lead.citta} ({lead.provincia}) · {lead.configurazione} · {lead.origine}
        </span>
      </div>

      <Badge className={cn("hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex", STATUS_STYLES[tone])}>
        {LEAD_STATUS_LABELS[lead.status]}
      </Badge>

      <div className="flex w-24 shrink-0 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${lead.score}%`, backgroundColor: scoreColor(lead.score) }}
          />
        </div>
        <span className="w-7 text-right text-sm font-bold tabular-nums text-foreground">
          {lead.score}
        </span>
      </div>
    </div>
  )
}

export function HotLeads({ leads }: { leads: Lead[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      {/* Lista */}
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-[18px] text-destructive" />
            Lead caldi
          </CardTitle>
          <CardDescription>Ordinati per score di interesse</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0.5">
          {leads.length > 0 ? (
            leads.map((lead, i) => <LeadRow key={lead.id} lead={lead} index={i} />)
          ) : (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nessun lead caldo per questa sede.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mappa */}
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Distribuzione lead</CardTitle>
          <CardDescription>5 sedi Solair sul territorio</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ItalyMap />
        </CardContent>
      </Card>
    </div>
  )
}
