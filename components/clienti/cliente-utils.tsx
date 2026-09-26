"use client"

import { cn } from "@/lib/utils"
import { StatoPill } from "@/components/shared/lightning-table"
import { STATO_CLIENTE_TONE, leadInitials } from "@/lib/mock-data"
import { valoriMultipli } from "@/lib/clienti/valori-multipli"
import { useStatoClienteQuery } from "@/lib/clienti/stato-cliente-store"

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

/**
 * Stato cliente a scelta multipla ("Installato;Logistica"): una pillola per
 * stato, ciascuna col proprio colore. Il colore viene dalla configurazione
 * (crm_stato_cliente); la tabella nel codice resta come ripiego finche' la
 * configurazione non e' caricata.
 */
export function StatoClienteBadge({ stato }: { stato?: string | null }) {
  const { data: configurati } = useStatoClienteQuery()
  const stati = valoriMultipli(stato)
  if (stati.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const tonoConfigurato = new Map((configurati ?? []).map((item) => [item.valore, item.tono]))
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {stati.map((valore) => (
        <StatoPill key={valore} tone={tonoConfigurato.get(valore) ?? STATO_TONE_LOOKUP[valore] ?? "muted"}>
          {valore}
        </StatoPill>
      ))}
    </span>
  )
}
