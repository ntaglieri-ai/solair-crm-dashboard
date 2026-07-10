"use client"

// Tag degli Installatori: campo testo libero (installatori.tag), nessun
// significato predefinito — implementazione autonoma, non condivide
// storage/infra con lib/tag-store.tsx (quello è multi-tag per i Lead; qui è
// un valore singolo per record). Colore derivato via hash deterministico,
// non persistito. Copia indipendente della stessa logica in
// components/scadenze/scadenza-tag-picker.tsx: due moduli separati, nessuna
// infrastruttura condivisa, per restare nel perimetro di questo task.
import { useMemo, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { IconPlus, IconCheck, IconSearch } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const INSTALLATORE_TAG_PALETTE = [
  "#3B82F6",
  "#22C55E",
  "#F97316",
  "#9CA3AF",
  "#EF4444",
  "#EAB308",
  "#14B8A6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#64748B",
] as const

export function installatoreTagColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return INSTALLATORE_TAG_PALETTE[Math.abs(hash) % INSTALLATORE_TAG_PALETTE.length]
}

function tagStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: `${color}20`,
    borderColor: `${color}55`,
    color,
    boxShadow: `inset 0 0 0 1px ${color}12`,
  }
}

export function InstallatoreTagDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

export function InstallatoreTagChip({ tag, className }: { tag: string | null; className?: string }) {
  if (!tag) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={tagStyle(installatoreTagColor(tag))}
    >
      <span className="truncate">{tag}</span>
    </span>
  )
}

/** Ricerca + selezione + creazione inline — riusabile in popover diversi. */
function InstallatoreTagPickerList({
  value,
  suggestions,
  onSelect,
  onClear,
}: {
  value: string | null
  suggestions: string[]
  onSelect: (tag: string) => void
  onClear?: () => void
}) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suggestions
    return suggestions.filter((t) => t.toLowerCase().includes(q))
  }, [suggestions, query])

  const exactMatch = suggestions.some((t) => t.toLowerCase() === query.trim().toLowerCase())
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

      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto py-1.5">
        {filtered.map((tag) => {
          const isOn = value === tag
          const color = installatoreTagColor(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onSelect(tag)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  isOn ? "border-transparent" : "border-border bg-transparent",
                )}
                style={isOn ? { backgroundColor: color } : undefined}
              >
                {isOn ? <IconCheck size={12} className="text-white" stroke={3} /> : null}
              </span>
              <InstallatoreTagDot color={color} />
              <span className="flex-1 truncate text-foreground">{tag}</span>
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
              onSelect(query.trim())
              setQuery("")
            }}
            className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <IconPlus size={15} className="text-teal" />
            <span className="truncate">
              Crea <span className="font-medium">{query.trim()}</span>
            </span>
            <InstallatoreTagDot color={installatoreTagColor(query.trim())} className="ml-auto" />
          </button>
        </div>
      ) : null}

      {value && onClear ? (
        <div className="border-t border-border px-1 pt-2">
          <button
            type="button"
            onClick={onClear}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X size={14} />
            Rimuovi tag
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** Campo tag per form (crea/modifica installatore): bottone + popover di selezione. */
export function InstallatoreTagField({
  value,
  onChange,
  suggestions,
}: {
  value: string
  onChange: (tag: string) => void
  suggestions: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
          >
            {value ? <InstallatoreTagChip tag={value} /> : <span className="text-muted-foreground">Nessun tag</span>}
            <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-full min-w-64 gap-0 p-2">
        <InstallatoreTagPickerList
          value={value || null}
          suggestions={suggestions}
          onSelect={(tag) => {
            onChange(tag)
            setOpen(false)
          }}
          onClear={value ? () => {
            onChange("")
            setOpen(false)
          } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Dialog "Cambia tag" per il context menu di riga.
 *
 * Non un Popover-in-menu-item: un ContextMenuItem passato come `render` a un
 * PopoverTrigger perde il suo `role="menuitem"` (sovrascritto dal trigger
 * del Popover, che si autoassegna `role="button"`/`aria-haspopup="dialog"`).
 * Il ContextMenu, non riconoscendolo più come voce valida, resta aperto e
 * sotto il popover intercetta la tastiera: si può cliccare "Cambia tag" e
 * vedere la lista, ma digitare nella ricerca non scrive nulla, quindi
 * l'opzione "Crea …" non compare mai (verificato in browser con tasti reali:
 * value dell'input resta "" mentre `.fill()` programmatico lo aggirava,
 * mascherando il bug nei test automatici). Un Dialog, aperto da un
 * ContextMenuItem normale e non annidato in nessun trigger, non ha questo
 * conflitto — stesso pattern già usato altrove in questo file/modulo per le
 * conferme di eliminazione.
 */
export function InstallatoreTagMenuDialog({
  value,
  suggestions,
  onSelect,
  open,
  onOpenChange,
}: {
  value: string | null
  suggestions: string[]
  onSelect: (tag: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambia tag</DialogTitle>
        </DialogHeader>
        <InstallatoreTagPickerList
          value={value}
          suggestions={suggestions}
          onSelect={(tag) => {
            onSelect(tag)
            onOpenChange(false)
          }}
          onClear={
            value
              ? () => {
                  onSelect("")
                  onOpenChange(false)
                }
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  )
}
