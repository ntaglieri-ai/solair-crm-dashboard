"use client"

import { scadenzaInitials } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/** Badge "Scaduta" rosso per le scadenze passate non chiuse. */
export function ScadutaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-semibold text-destructive",
        className,
      )}
    >
      Scaduta
    </span>
  )
}

/** Avatar con iniziali, stile coerente con gli altri moduli. */
export function ScadenzaAvatar({
  nome,
  size = 32,
}: {
  nome: string
  size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {scadenzaInitials(nome)}
    </span>
  )
}
