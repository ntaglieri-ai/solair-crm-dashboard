import { cn } from "@/lib/utils"
import { StatoPill } from "@/components/shared/lightning-table"
import {
  type StatoCliente,
  STATO_CLIENTE_TONE,
  leadInitials,
} from "@/lib/mock-data"

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

export function StatoClienteBadge({ stato }: { stato: StatoCliente }) {
  return <StatoPill tone={STATO_CLIENTE_TONE[stato]}>{stato}</StatoPill>
}
