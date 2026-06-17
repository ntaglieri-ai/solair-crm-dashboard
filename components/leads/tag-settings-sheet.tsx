"use client"

import { useState } from "react"
import {
  IconTrash,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
import { useTags, TAG_PALETTE, type Tag } from "@/lib/tag-store"
import { TagDot } from "./tag-controls"

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (c: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Cambia colore tag"
            className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-border"
          >
            <TagDot color={value} className="size-3.5" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {TAG_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colore ${c}`}
              onClick={() => onChange(c)}
              className={cn(
                "size-5 rounded-full transition",
                value === c && "ring-2 ring-foreground ring-offset-1",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TagRow({ tag }: { tag: Tag }) {
  const { usageCount, renameTag, recolorTag, deleteTag } = useTags()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const count = usageCount(tag.id)

  const commit = () => {
    renameTag(tag.id, draft)
    setEditing(false)
  }

  return (
    <>
      <div className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60">
        <ColorPicker value={tag.color} onChange={(c) => recolorTag(tag.id, c)} />

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
            className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(tag.name)
              setEditing(true)
            }}
            className="flex-1 truncate text-left text-sm font-medium text-foreground hover:underline"
          >
            {tag.name}
          </button>
        )}

        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          ×{count} lead
        </span>

        <button
          type="button"
          aria-label={`Elimina tag ${tag.name}`}
          onClick={() => setConfirmDelete(true)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <IconTrash size={15} stroke={1.8} />
        </button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina tag</DialogTitle>
            <DialogDescription>
              Vuoi eliminare il tag{" "}
              <span className="font-medium text-foreground">{tag.name}</span>?
              Verrà rimosso da {count} lead. L&apos;azione non è reversibile.
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

function AddTagRow() {
  const { createTag } = useTags()
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(TAG_PALETTE[3])

  const add = () => {
    if (!name.trim()) return
    createTag(name, color)
    setName("")
    setColor(TAG_PALETTE[3])
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-2 py-2">
      <ColorPicker value={color} onChange={setColor} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add()
        }}
        placeholder="Nuovo tag…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button size="sm" onClick={add} disabled={!name.trim()}>
        <IconPlus size={15} stroke={2} data-icon="inline-start" />
        Aggiungi
      </Button>
    </div>
  )
}

export function TagSettingsSheet() {
  const { tags } = useTags()

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Impostazioni tag"
            className="bg-card"
          >
            <IconSettings size={16} stroke={1.8} className="text-muted-foreground" />
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Lead · Tag</SheetTitle>
          <SheetDescription>
            Gestisci i tag disponibili: rinomina, cambia colore o elimina.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </div>

        <div className="border-t border-border p-3">
          <AddTagRow />
        </div>
      </SheetContent>
    </Sheet>
  )
}
