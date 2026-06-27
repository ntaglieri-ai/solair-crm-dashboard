"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CrmBreadcrumbItem {
  label: string
  /** Se presente la voce è cliccabile; altrimenti è la pagina corrente. */
  action?: () => void
}

/**
 * Breadcrumb riutilizzabile per le pagine CRM Settings.
 * Le voci con `action` sono cliccabili (hover underline); l'ultima voce
 * senza action rappresenta la pagina corrente ed è non cliccabile.
 */
export function CrmBreadcrumb({ items }: { items: CrmBreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
    >
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? (
            <ChevronRight
              className="size-3 text-muted-foreground/60"
              aria-hidden
            />
          ) : null}
          {item.action ? (
            <button
              type="button"
              onClick={item.action}
              className="cursor-pointer rounded-sm transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </button>
          ) : (
            <span aria-current="page" className="text-muted-foreground/70">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

/**
 * Bottone "‹ Torna a [sezione]" mostrato in cima alle sidebar laterali
 * delle pagine CRM Settings, per riaprire il Layer 2 corrispondente.
 */
export function CrmSectionBackLink({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <div className={cn("mb-4 border-b border-border pb-2", className)}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  )
}
