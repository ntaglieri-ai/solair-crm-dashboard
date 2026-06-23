import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  type InstallatoreStato,
  INSTALLATORE_STATO_TONE,
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

export function InstallatoreAvatar({
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

export function StatoInstallatoreBadge({
  stato,
}: {
  stato: InstallatoreStato
}) {
  const tone = INSTALLATORE_STATO_TONE[stato]
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
