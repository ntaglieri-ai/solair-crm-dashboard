"use client"

import { useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ClienteQuickFilterFields,
  countActiveClienteFilters,
  type ClienteFilterState,
} from "@/components/clienti/cliente-filters"

/** Drawer unico per i filtri Clienti: un solo pulsante in header, un solo
 * pannello (a differenza dei vecchi dropdown impilati sopra la lista). */
export function ClienteFiltersDrawer({
  filters,
  onChange,
  onReset,
  trigger,
}: {
  filters: ClienteFilterState
  onChange: (next: ClienteFilterState) => void
  onReset: () => void
  trigger: (ctx: { onClick: () => void; count: number }) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const count = countActiveClienteFilters(filters)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger({ onClick: () => setOpen(true), count })}

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[340px] gap-0 p-0 sm:max-w-[340px]"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-4">
          <SheetTitle>Filtra clienti per</SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <ClienteQuickFilterFields filters={filters} onChange={onChange} onReset={onReset} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
