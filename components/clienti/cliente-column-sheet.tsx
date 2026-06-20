"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  CLIENTE_COLUMNS,
  CLIENTE_COLUMN_GROUPS,
  DEFAULT_CLIENTE_COLUMNS,
  type ClienteColumnId,
} from "@/lib/mock-data"

export function ClienteColumnSheet({
  open,
  onOpenChange,
  visibleCols,
  onVisibleColsChange,
  trigger,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  visibleCols: ClienteColumnId[]
  onVisibleColsChange: (cols: ClienteColumnId[]) => void
  trigger: React.ReactNode
}) {
  const [draft, setDraft] = useState<Set<ClienteColumnId>>(
    () => new Set(visibleCols),
  )
  const [query, setQuery] = useState("")

  // Risincronizza la bozza ad ogni apertura del pannello
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(new Set(visibleCols))
      setQuery("")
    }
    onOpenChange(next)
  }

  const toggle = (id: ClienteColumnId) => {
    setDraft((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const q = query.trim().toLowerCase()

  const groups = useMemo(() => {
    return CLIENTE_COLUMN_GROUPS.map((group) => ({
      group,
      cols: CLIENTE_COLUMNS.filter(
        (c) =>
          c.group === group &&
          (q === "" || c.label.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.cols.length > 0)
  }, [q])

  const handleSave = () => {
    // Mantiene l'ordine delle colonne già visibili, poi aggiunge le nuove
    // seguendo l'ordine dei gruppi nel registro CLIENTE_COLUMNS.
    const kept = visibleCols.filter((id) => draft.has(id))
    const added = CLIENTE_COLUMNS.filter(
      (c) => draft.has(c.id) && !visibleCols.includes(c.id),
    ).map((c) => c.id)
    onVisibleColsChange([...kept, ...added])
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger as React.ReactElement} aria-label="Gestisci colonne" />
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Gestisci colonne</SheetTitle>
          <SheetDescription>
            Scegli quali colonne mostrare nell&apos;elenco clienti.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca colonna"
              className="bg-card pl-9"
              aria-label="Cerca colonna"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {draft.size} di {CLIENTE_COLUMNS.length} colonne selezionate
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(new Set(DEFAULT_CLIENTE_COLUMNS))}
            >
              Ripristina default
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna colonna trovata.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(({ group, cols }) => (
                <div key={group} className="flex flex-col gap-0.5">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  {cols.map((col) => (
                    <label
                      key={col.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary/60"
                    >
                      <Checkbox
                        checked={draft.has(col.id)}
                        onCheckedChange={() => toggle(col.id)}
                      />
                      <span className="text-foreground">{col.label}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-4">
          <SheetClose
            render={<Button variant="outline">Annulla</Button>}
          />
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={handleSave}
          >
            Salva
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
