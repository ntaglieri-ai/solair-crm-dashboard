"use client"

import { useMemo, useState } from "react"
import { Braces, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Elenco ricercabile dei campi del modulo, per inserire {Campo} senza doverne
 * ricordare il nome esatto (es. "COD- MODULI", trattino compreso).
 *
 * Stesso pattern di MultiFilterSelect (Popover + ricerca), ma a inserimento
 * singolo invece che multi-selezione: qui cliccare una voce la scrive nel
 * testo e richiude, non la "seleziona" in uno stato persistente.
 */
export function FieldPlaceholderPicker({
  fields,
  onInsert,
  disabled,
  label = "Inserisci campo",
}: {
  /** Etichette dei campi del modulo attivo (vedi lib/email/template-fields.ts). */
  fields: string[]
  /** Riceve il token completo, es. "{Nr. Moduli}". */
  onInsert: (token: string) => void
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const visibleFields = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? fields.filter((campo) => campo.toLowerCase().includes(q)) : fields
  }, [fields, query])

  if (fields.length === 0) return null

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-card px-2 text-xs"
            disabled={disabled}
          />
        }
      >
        <Braces className="size-3.5" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca campo…"
            className="h-8 bg-card pl-8"
            autoFocus
          />
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto pr-1">
          {visibleFields.map((campo) => (
            <button
              key={campo}
              type="button"
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              onClick={() => {
                onInsert(`{${campo}}`)
                setOpen(false)
                setQuery("")
              }}
            >
              <span className="min-w-0 truncate">{campo}</span>
            </button>
          ))}
          {visibleFields.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Nessun campo trovato</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
