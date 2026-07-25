"use client"

import { useMemo, useState } from "react"
import { IconPlus, IconCheck, IconSearch } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useClienteTags, CLIENTE_TAG_PALETTE, type ClienteTag } from "@/lib/cliente-tag-store"

function tagStyle(color: string): React.CSSProperties {
  const resolved = color || "#64748B"
  return {
    backgroundColor: `${resolved}20`,
    borderColor: `${resolved}55`,
    color: resolved,
    boxShadow: `inset 0 0 0 1px ${resolved}12`,
  }
}

export function ClienteTagDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

export function ClienteTagBadge({ tag, className }: { tag: ClienteTag; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={tagStyle(tag.color)}
    >
      {tag.name}
    </span>
  )
}

/** Lista tag di un cliente, letta dallo store globale. */
export function ClienteTagBadges({
  clienteId,
  empty = "—",
  max,
}: {
  clienteId: string
  empty?: string
  max?: number
}) {
  const { getClienteTags } = useClienteTags()
  const tags = getClienteTags(clienteId)
  if (!tags.length) {
    return <span className="text-xs text-muted-foreground">{empty}</span>
  }
  const shown = max ? tags.slice(0, max) : tags
  const extra = max ? tags.length - shown.length : 0
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span key={tag.id} className="animate-in zoom-in-90 duration-150">
          <ClienteTagBadge tag={tag} />
        </span>
      ))}
      {extra > 0 ? (
        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  )
}

/** Contenuto interno del selettore tag — riusabile dentro Popover o ContextMenu. */
export function ClienteTagPicker({
  clienteId,
  onDone,
}: {
  clienteId: string
  onDone?: () => void
}) {
  const { tags, clienteTagIds, toggleClienteTag, createAndAssign } = useClienteTags()
  const [query, setQuery] = useState("")
  const assigned = new Set(clienteTagIds[clienteId] ?? [])
  const [newColor, setNewColor] = useState<string>(CLIENTE_TAG_PALETTE[0])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((t) => t.name.toLowerCase().includes(q))
  }, [tags, query])

  const exactMatch = tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase())
  const canCreate = query.trim().length > 0 && !exactMatch

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-1 pb-2">
        <IconSearch size={15} className="text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca o crea tag…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto py-1.5">
        {filtered.map((tag) => {
          const isOn = assigned.has(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleClienteTag(clienteId, tag.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  isOn ? "border-transparent" : "border-border bg-transparent",
                )}
                style={isOn ? { backgroundColor: tag.color } : undefined}
              >
                {isOn ? <IconCheck size={12} className="text-white" stroke={3} /> : null}
              </span>
              <ClienteTagDot color={tag.color} />
              <span className="flex-1 truncate text-foreground">{tag.name}</span>
            </button>
          )
        })}

        {filtered.length === 0 && !canCreate ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nessun tag trovato.
          </p>
        ) : null}
      </div>

      {canCreate ? (
        <div className="flex items-center gap-2 border-t border-border px-1 pt-2">
          <button
            type="button"
            onClick={() => {
              createAndAssign(clienteId, query, newColor)
              setQuery("")
              onDone?.()
            }}
            className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <IconPlus size={15} className="text-teal" />
            <span className="truncate">
              Crea <span className="font-medium">{query.trim()}</span>
            </span>
            <ClienteTagDot color={newColor} className="ml-auto" />
          </button>
        </div>
      ) : null}

      {canCreate ? (
        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-2">
          {CLIENTE_TAG_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colore ${c}`}
              onClick={() => setNewColor(c)}
              className={cn(
                "size-4 rounded-full ring-offset-1 transition",
                newColor === c && "ring-2 ring-foreground",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Popover completo con trigger custom. */
export function ClienteTagAssignPopover({
  clienteId,
  trigger,
  open,
  onOpenChange,
  align = "start",
}: {
  clienteId: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger ? <PopoverTrigger render={trigger as never} /> : null}
      <PopoverContent align={align} className="w-72 gap-0 p-2">
        <ClienteTagPicker clienteId={clienteId} onDone={() => onOpenChange?.(false)} />
      </PopoverContent>
    </Popover>
  )
}
