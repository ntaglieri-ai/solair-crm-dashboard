"use client"

import { useState } from "react"
import {
  IconTrash,
  IconPlus,
  IconTag,
  IconColumns3,
  IconAdjustmentsHorizontal,
  IconLayoutList,
  IconList,
  IconListDetails,
  IconRoute,
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
import { Checkbox } from "@/components/ui/checkbox"
import { useTags, TAG_PALETTE, type Tag } from "@/lib/tag-store"
import { TagDot } from "./tag-controls"
import { LeadTagSection } from "./lead-tag-section"
import {
  LEAD_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  type LeadColumnId,
} from "@/lib/mock-data"
import type { Density } from "./lead-table"
import { RulesSection } from "./assignment-rules"

/* -------------------------------------------------------------------------- */
/*                              Sezione: Tag                                  */
/* -------------------------------------------------------------------------- */

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

export function TagSection() {
  const { tags } = useTags()
  return (
    <div className="flex flex-col gap-1">
      {tags.map((tag) => (
        <TagRow key={tag.id} tag={tag} />
      ))}
      <div className="mt-2">
        <AddTagRow />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                           Sezione: Vista colonne                           */
/* -------------------------------------------------------------------------- */

function ColumnsSection({
  visible,
  onChange,
}: {
  visible: LeadColumnId[]
  onChange: (cols: LeadColumnId[]) => void
}) {
  const set = new Set(visible)

  const toggle = (id: LeadColumnId) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(LEAD_COLUMNS.filter((c) => next.has(c.id)).map((c) => c.id))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {visible.length} di {LEAD_COLUMNS.length} colonne visibili
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...DEFAULT_VISIBLE_COLUMNS])}
        >
          Ripristina default
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        {LEAD_COLUMNS.map((col) => (
          <label
            key={col.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-secondary/60"
          >
            <Checkbox
              checked={set.has(col.id)}
              onCheckedChange={() => toggle(col.id)}
            />
            <span className="text-foreground">{col.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Sezione: Generali                               */
/* -------------------------------------------------------------------------- */

const DENSITY_OPTIONS: {
  value: Density
  label: string
  icon: typeof IconList
}[] = [
  { value: "comoda", label: "Compatta", icon: IconLayoutList },
  { value: "normale", label: "Normale", icon: IconList },
  { value: "densa", label: "Densa", icon: IconListDetails },
]

const ROWS_OPTIONS = [10, 30, 50]

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      {children}
    </div>
  )
}

export function GeneralSection({
  density,
  onDensityChange,
  rowsPerPage,
  onRowsPerPageChange,
  entityLabel = "lead",
}: {
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  entityLabel?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <SettingRow
        title="Densità tabella"
        description={`Spaziatura delle righe nell'elenco ${entityLabel}.`}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {DENSITY_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = density === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-label={opt.label}
                aria-pressed={active}
                onClick={() => onDensityChange(opt.value)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors duration-150",
                  active
                    ? "border border-navy bg-[#EEF2FF] text-navy"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon size={18} stroke={1.8} />
              </button>
            )
          })}
        </div>
      </SettingRow>

      <SettingRow
        title="Righe per pagina"
        description={`Numero di ${entityLabel} mostrati per pagina.`}
      >
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {ROWS_OPTIONS.map((n) => {
            const active = rowsPerPage === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => onRowsPerPageChange(n)}
                className={cn(
                  "flex h-8 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium tabular-nums transition-colors duration-150",
                  active
                    ? "border border-navy bg-[#EEF2FF] text-navy"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {n}
              </button>
            )
          })}
        </div>
      </SettingRow>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          Sheet impostazioni Lead                           */
/* -------------------------------------------------------------------------- */

export type SettingsSectionId = "tag" | "regole" | "colonne" | "generali"

const SECTIONS: {
  id: SettingsSectionId
  label: string
  description: string
  icon: typeof IconTag
}[] = [
  {
    id: "generali",
    label: "Generali",
    description: "Densità tabella e impaginazione dell'elenco lead.",
    icon: IconAdjustmentsHorizontal,
  },
  {
    id: "colonne",
    label: "Vista colonne",
    description: "Scegli quali colonne mostrare nella tabella lead.",
    icon: IconColumns3,
  },
  {
    id: "tag",
    label: "Tag",
    description: "Gestisci i tag: rinomina, cambia colore o elimina.",
    icon: IconTag,
  },
  {
    id: "regole",
    label: "Regole di assegnazione",
    description:
      "Assegna automaticamente i nuovi lead ai commerciali in base a criteri.",
    icon: IconRoute,
  },
]

export function LeadSettingsSheet({
  visibleCols,
  onVisibleColsChange,
  density,
  onDensityChange,
  rowsPerPage,
  onRowsPerPageChange,
  trigger,
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  visibleCols: LeadColumnId[]
  onVisibleColsChange: (cols: LeadColumnId[]) => void
  density: Density
  onDensityChange: (d: Density) => void
  rowsPerPage: number
  onRowsPerPageChange: (n: number) => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (o: boolean) => void
  section: SettingsSectionId
  onSectionChange: (s: SettingsSectionId) => void
}) {
  const active = SECTIONS.find((s) => s.id === section)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Impostazioni Lead</SheetTitle>
          <SheetDescription>
            Personalizza tag, colonne e visualizzazione dell&apos;elenco lead.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1">
          {/* Nav sezioni */}
          <nav className="w-44 shrink-0 border-r border-border p-2">
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const isActive = s.id === section
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onSectionChange(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon size={17} stroke={1.8} />
                      {s.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Contenuto sezione */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {active.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {active.description}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {section === "tag" && <LeadTagSection />}
              {section === "regole" && <RulesSection />}
              {section === "colonne" && (
                <ColumnsSection
                  visible={visibleCols}
                  onChange={onVisibleColsChange}
                />
              )}
              {section === "generali" && (
                <GeneralSection
                  density={density}
                  onDensityChange={onDensityChange}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={onRowsPerPageChange}
                />
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
