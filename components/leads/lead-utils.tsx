import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  type StatoLead,
  type OrigineLead,
  STATO_LEAD_TONE,
  tagTone,
  leadInitials,
} from "@/lib/mock-data"

const TONE_STYLES: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
  teal: "bg-teal/10 text-teal",
  destructive: "bg-destructive/10 text-destructive",
}

const AVATAR_COLORS = [
  "bg-navy text-navy-foreground",
  "bg-teal text-teal-foreground",
  "bg-info text-info-foreground",
  "bg-warning text-warning-foreground",
  "bg-destructive text-destructive-foreground",
]

function avatarColor(seed: string) {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function LeadAvatar({
  nome,
  className,
}: {
  nome: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        avatarColor(nome),
        className,
      )}
      aria-hidden="true"
    >
      {leadInitials(nome)}
    </div>
  )
}

export function StatusBadge({ stato }: { stato: StatoLead }) {
  const tone = STATO_LEAD_TONE[stato]
  return (
    <Badge
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_STYLES[tone],
      )}
    >
      {stato}
    </Badge>
  )
}

export function TagBadges({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
            TONE_STYLES[tagTone(tag)],
          )}
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}

const ORIGINE_STYLES: Record<OrigineLead, string> = {
  Facebook: "bg-info/10 text-info",
  "Pubblicità": "bg-warning/10 text-warning",
  "Sito web": "bg-teal/10 text-teal",
  Manuale: "bg-muted text-muted-foreground",
  "Utenza di servizio": "bg-navy/10 text-navy",
}

export function OrigineBadge({ origine }: { origine: OrigineLead }) {
  return (
    <Badge
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        ORIGINE_STYLES[origine],
      )}
    >
      {origine}
    </Badge>
  )
}

export function scoreColor(score: number) {
  if (score > 80) return "var(--success)"
  if (score >= 50) return "var(--warning)"
  return "var(--chart-5)"
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
