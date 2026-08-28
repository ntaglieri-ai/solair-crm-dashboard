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
  ScadenzaQuickFilterFields,
  countActiveScadenzaFilters,
  type ScadenzaFilterState,
} from "@/components/scadenze/scadenza-filters"

export function ScadenzaFiltersDrawer({
  filters,
  onChange,
  onReset,
  trigger,
}: {
  filters: ScadenzaFilterState
  onChange: (next: ScadenzaFilterState) => void
  onReset: () => void
  trigger: (ctx: { onClick: () => void; count: number }) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const count = countActiveScadenzaFilters(filters)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger({ onClick: () => setOpen(true), count })}

      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[340px] gap-0 p-0 sm:max-w-[340px]"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border p-4">
          <SheetTitle>Filtra scadenze per</SheetTitle>
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
          <ScadenzaQuickFilterFields filters={filters} onChange={onChange} onReset={onReset} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
