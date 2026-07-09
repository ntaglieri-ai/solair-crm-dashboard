"use client"

import {
  type StatoCompito,
  type PrioritaCompito,
  type Compito,
  STATO_COMPITO_TONE,
  PRIORITA_COMPITO_TONE,
  compitoInitials,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { CorrelatoTipo } from "@/components/shared/correlato-picker"

/** Percorso di dettaglio per il record "Correlato a" di un compito. */
export function correlatoHref(correlato: NonNullable<Compito["Correlato a"]>): string {
  switch (correlato.tipo) {
    case "Lead":
      return `/leads/${correlato.id}`
    case "Scadenza":
      return `/scadenze/${correlato.id}`
    case "Cliente":
    default:
      return `/clienti/${correlato.id}`
  }
}

/** Converte il tipo minuscolo di CorrelatoPicker/API nel formato del Compito. */
export function correlatoTipoLabel(
  tipo: CorrelatoTipo,
): NonNullable<Compito["Correlato a"]>["tipo"] {
  switch (tipo) {
    case "lead":
      return "Lead"
    case "scadenza":
      return "Scadenza"
    case "cliente":
    default:
      return "Cliente"
  }
}

/** Badge stato compito con tono colorato da token design. */
export function StatoBadge({
  stato,
  className,
}: {
  stato: StatoCompito
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATO_COMPITO_TONE[stato],
        className,
      )}
    >
      {stato}
    </span>
  )
}

/** Badge priorità con pallino + tono. */
export function PrioritaBadge({
  priorita,
  className,
}: {
  priorita: PrioritaCompito
  className?: string
}) {
  const dot =
    priorita === "Alto"
      ? "bg-destructive"
      : priorita === "Medio"
        ? "bg-warning"
        : "bg-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        PRIORITA_COMPITO_TONE[priorita],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {priorita}
    </span>
  )
}

/** Avatar con iniziali, tonalità derivata dal nome. */
export function CompitoAvatar({
  nome,
  size = 32,
}: {
  nome: string
  size?: number
}) {
  const initials = compitoInitials(nome)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
