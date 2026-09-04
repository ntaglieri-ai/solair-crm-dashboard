import { cn } from "@/lib/utils"
import { StatoPill } from "@/components/shared/lightning-table"
import { STATO_CLIENTE_TONE, leadInitials } from "@/lib/mock-data"

type StatoTone = "muted" | "success" | "warning" | "info" | "teal" | "destructive"
const STATO_TONE_LOOKUP = STATO_CLIENTE_TONE as Record<string, StatoTone | undefined>

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

export function ClienteAvatar({
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

export function StatoClienteBadge({ stato }: { stato?: string | null }) {
  if (!stato) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <StatoPill tone={STATO_TONE_LOOKUP[stato] ?? "muted"}>
      {stato}
    </StatoPill>
  )
}
