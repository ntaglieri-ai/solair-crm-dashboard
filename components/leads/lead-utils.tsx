import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  type Lead,
  type LeadStatus,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
} from "@/lib/mock-data"

export const STATUS_STYLES: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
  teal: "bg-teal/10 text-teal",
  destructive: "bg-destructive/10 text-destructive",
}

const ORIGINE_STYLES: Record<string, string> = {
  Facebook: "bg-info/10 text-info",
  Pubblicità: "bg-warning/10 text-warning",
  "Sito web": "bg-teal/10 text-teal",
  Manuale: "bg-muted text-muted-foreground",
}

const AVATAR_COLORS = [
  "bg-navy text-navy-foreground",
  "bg-teal text-teal-foreground",
  "bg-info text-info-foreground",
  "bg-warning text-warning-foreground",
  "bg-destructive text-destructive-foreground",
]

export function initials(nome: string) {
  return nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function avatarColor(seed: string) {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function scoreColor(score: number) {
  if (score > 80) return "var(--success)"
  if (score >= 50) return "var(--warning)"
  return "var(--chart-5)"
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const tone = LEAD_STATUS_TONE[status]
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[tone],
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  )
}

export function OrigineBadge({ origine }: { origine: string }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        ORIGINE_STYLES[origine] ?? "bg-muted text-muted-foreground",
      )}
    >
      {origine}
    </Badge>
  )
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex w-24 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className="w-7 text-right text-sm font-bold tabular-nums text-foreground">
        {score}
      </span>
    </div>
  )
}

export function LeadAvatar({
  lead,
  className,
}: {
  lead: Pick<Lead, "nome" | "cognome">
  className?: string
}) {
  const full = lead.cognome ? `${lead.nome} ${lead.cognome}` : lead.nome
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        avatarColor(full),
        className,
      )}
    >
      {initials(full)}
    </div>
  )
}
