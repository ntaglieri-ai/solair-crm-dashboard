import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { type UserRole, ROLE_LABEL, ROLE_TONE } from "@/lib/mock-data"

/** Classi token per i toni dei badge ruolo. */
const ROLE_TONE_CLASS: Record<"navy" | "teal" | "warning", string> = {
  navy: "bg-navy text-navy-foreground",
  teal: "bg-teal text-teal-foreground",
  warning: "bg-warning text-warning-foreground",
}

/** Badge colorato per il ruolo utente (admin=navy, commerciale=teal, tecnico=ambra). */
export function RoleBadge({ ruolo }: { ruolo: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
        ROLE_TONE_CLASS[ROLE_TONE[ruolo]],
      )}
    >
      {ROLE_LABEL[ruolo]}
    </span>
  )
}

/** Avatar circolare con iniziali, in stile coerente con la sidebar. */
export function InitialsAvatar({
  iniziali,
  className,
}: {
  iniziali: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-navy-foreground",
        className,
      )}
      aria-hidden
    >
      {iniziali}
    </div>
  )
}

/** Intestazione di una sezione delle impostazioni: titolo + descrizione + azione. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** Card metrica per le stat row (etichetta + valore grande + icona opzionale). */
export function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      {icon ? (
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
    </div>
  )
}

/** Pallino colorato (usato per i valori configurabili). */
export function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}
