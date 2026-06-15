"use client"

import { useEffect, useState } from "react"
import { Columns3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type LeadColumnId,
} from "@/lib/mock-data"

export function ColumnManager({
  visible,
  onChange,
}: {
  visible: LeadColumnId[]
  onChange: (cols: LeadColumnId[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Set<LeadColumnId>>(new Set(visible))

  // sincronizza il draft all'apertura del dialog
  useEffect(() => {
    if (open) setDraft(new Set(visible))
  }, [open, visible])

  function toggle(id: LeadColumnId) {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    // mantiene l'ordine canonico delle colonne Zoho
    onChange(LEAD_COLUMNS.filter((c) => draft.has(c.id)).map((c) => c.id))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Columns3 data-icon="inline-start" />
            Gestisci colonne
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestisci colonne</DialogTitle>
          <DialogDescription>
            Seleziona le colonne da mostrare nella tabella lead.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[50vh] overflow-y-auto px-1">
          <div className="flex flex-col gap-0.5">
            {LEAD_COLUMNS.map((col) => {
              const checked = draft.has(col.id)
              return (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(col.id)}
                  />
                  <span className="text-foreground">{col.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft(new Set(DEFAULT_VISIBLE_COLUMNS))}
            className="sm:mr-auto"
          >
            Ripristina default
          </Button>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Annulla
          </DialogClose>
          <Button size="sm" onClick={handleSave}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
