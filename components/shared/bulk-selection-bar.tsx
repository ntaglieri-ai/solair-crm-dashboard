"use client"

// Barra fissa in basso che compare quando ci sono righe selezionate.
//
// Ricalca 1:1 il chrome di components/leads/bulk-toolbar.tsx (che resta al suo
// posto perche' ha azioni proprie del modulo Lead): Clienti e Installatori non
// avevano una barra del genere, e questa serve a dare loro lo stesso punto
// d'accesso in basso all'invio email di massa.

import { IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

export function BulkSelectionBar({
  count,
  singolare,
  plurale,
  onClear,
  children,
}: {
  count: number
  singolare: string
  plurale: string
  onClear: () => void
  children: ReactNode
}) {
  if (count === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-200">
        <span className="px-2 text-sm font-medium text-foreground">
          <span className="font-bold tabular-nums text-navy">{count}</span>{" "}
          {count === 1 ? singolare : plurale}
        </span>

        <span className="mx-1 h-6 w-px bg-border" />

        {children}

        <span className="mx-1 h-6 w-px bg-border" />

        <Button
          size="icon"
          variant="ghost"
          aria-label="Deseleziona tutto"
          onClick={onClear}
          className="size-9"
        >
          <IconX size={18} stroke={1.8} />
        </Button>
      </div>
    </div>
  )
}
