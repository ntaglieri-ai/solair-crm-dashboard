"use client"

import { useMemo, useState } from "react"
import {
  IconPencil,
  IconTrash,
  IconChevronDown,
  IconPlus,
  IconUser,
  IconSearch,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LeadTagProvider,
  useLeadTags,
  LEAD_TAG_PALETTE,
  MAX_LEAD_TAGS,
  isLightColor,
  type LeadTag,
} from "@/lib/lead-tag-store"

/* -------------------------------------------------------------------------- */
/*                          Pill a freccia (chevron)                          */
/* -------------------------------------------------------------------------- */

function LeadTagPill({ tag }: { tag: LeadTag }) {
  const light = isLightColor(tag.color)
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center py-1 pl-2.5 pr-4 text-[13px] font-medium leading-none"
      style={{
        backgroundColor: tag.color,
        color: light ? "#1f2937" : "#ffffff",
        clipPath:
          "polygon(0 0, calc(100% - 9px) 0, 100% 50%, calc(100% - 9px) 100%, 0 100%)",
      }}
      title={tag.name}
    >
      <span className="truncate">{tag.name}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*                       Selettore colore (dropdown)                          */
/* -------------------------------------------------------------------------- */

function ColorDropdown({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (c: string) => void
  ariaLabel: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-1.5 transition hover:bg-secondary/60"
          >
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: value }}
              aria-hidden="true"
            />
            <IconChevronDown size={13} className="text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {LEAD_TAG_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colore ${c}`}
              onClick={() => onChange(c)}
              className={cn(
                "size-5 rounded-full transition",
                value.toLowerCase() === c.toLowerCase() &&
                  "ring-2 ring-foreground ring-offset-1",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Riga tag                                   */
/* -------------------------------------------------------------------------- */

function TagRow({ tag }: { tag: LeadTag }) {
  const { renameTag, recolorTag, deleteTag } = useLeadTags()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const commit = () => {
    renameTag(tag.id, draft)
    setEditing(false)
  }

  return (
    <>
      <div className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5 transition-colors hover:bg-secondary/40">
        {/* Colore del tag */}
        <div>
          <ColorDropdown
            value={tag.color}
            onChange={(c) => recolorTag(tag.id, c)}
            ariaLabel={`Cambia colore del tag ${tag.name}`}
          />
        </div>

        {/* Nome tag + azioni */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex w-9 shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              aria-label={`Rinomina tag ${tag.name}`}
              onClick={() => {
                setDraft(tag.name)
                setEditing(true)
              }}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <IconPencil size={14} stroke={1.8} />
            </button>
            <button
              type="button"
              aria-label={`Elimina tag ${tag.name}`}
              onClick={() => setConfirmDelete(true)}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <IconTrash size={14} stroke={1.8} />
            </button>
          </div>

          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit()
                if (e.key === "Escape") {
                  setDraft(tag.name)
                  setEditing(false)
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <LeadTagPill tag={tag} />
          )}

          <span className="ml-1 hidden shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground group-hover:inline-block">
            {tag.uso}
          </span>
        </div>

        {/* Ultima modifica */}
        <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <IconUser size={14} stroke={1.8} />
          </span>
          <span>{tag.modificato}</span>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina tag</DialogTitle>
            <DialogDescription>
              Vuoi eliminare il tag{" "}
              <span className="font-medium text-foreground">{tag.name}</span>?
              Verrà rimosso da {tag.uso} lead. L&apos;azione non è reversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteTag(tag.id)
                setConfirmDelete(false)
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Modale "Aggiungi tag"                             */
/* -------------------------------------------------------------------------- */

function AddTagDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { createTags } = useLeadTags()
  const [value, setValue] = useState("")
  const [color, setColor] = useState<string>(LEAD_TAG_PALETTE[14])

  const reset = () => {
    setValue("")
    setColor(LEAD_TAG_PALETTE[14])
  }

  const save = () => {
    if (!value.trim()) return
    createTags(value, color)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi tag</DialogTitle>
          <DialogDescription className="sr-only">
            Inserisci uno o più tag separati da virgole e scegli il colore.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save()
            }}
            placeholder="Inserisci i tag"
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Colore del tag
            </span>
            <div className="flex items-center gap-2">
              <span
                className="size-7 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                {LEAD_TAG_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colore ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-5 rounded-full transition",
                      color.toLowerCase() === c.toLowerCase() &&
                        "ring-2 ring-foreground ring-offset-1",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="mr-auto text-xs text-muted-foreground">
            Separa i tag tramite virgole
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={save} disabled={!value.trim()}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*                       Contenuto interno (con store)                        */
/* -------------------------------------------------------------------------- */

function TagManager() {
  const { tags } = useLeadTags()
  const [query, setQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  return (
    <div className="flex flex-col gap-3">
      {/* Barra superiore */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca tag"
            className="bg-card pl-9"
            aria-label="Cerca tag"
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus size={16} stroke={2} data-icon="inline-start" />
            Nuovo tag
          </Button>
          <span className="text-xs text-muted-foreground">
            Tag utilizzati: {tags.length} / {MAX_LEAD_TAGS}
          </span>
        </div>
      </div>

      {/* Tabella tag */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-border bg-secondary/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Colore del tag</span>
          <span>Nome tag</span>
          <span>Ultima modifica</span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nessun tag trovato.
          </p>
        ) : (
          <div>
            {filtered.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>

      <AddTagDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Export pubblico                               */
/* -------------------------------------------------------------------------- */

export function LeadTagSection() {
  return (
    <LeadTagProvider>
      <TagManager />
    </LeadTagProvider>
  )
}
