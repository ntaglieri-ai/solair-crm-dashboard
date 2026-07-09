"use client"

import { useEffect, useRef, useState } from "react"
import { IconLoader2, IconSearch, IconX } from "@tabler/icons-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export type CorrelatoTipo = "lead" | "cliente" | "scadenza"

export interface CorrelatoValue {
  tipo: CorrelatoTipo
  id: string
  nome: string
}

const TIPO_LABEL: Record<CorrelatoTipo, string> = {
  lead: "Lead",
  cliente: "Cliente",
  scadenza: "Scadenza",
}

const TIPO_ORDER: CorrelatoTipo[] = ["lead", "cliente", "scadenza"]

/**
 * Combobox di ricerca per collegare un compito a Lead/Cliente/Scadenza.
 * `locked` mostra il valore fisso in sola lettura (apertura da scheda
 * dettaglio); in modalità libera cerca su /api/search/correlabili con
 * debounce 300ms e raggruppa i risultati per tipo.
 */
export function CorrelatoPicker({
  value,
  onSelect,
  locked = false,
  placeholder = "Cerca lead, cliente o scadenza…",
  disabled = false,
  allowedTipi,
}: {
  value: CorrelatoValue | null
  onSelect: (value: CorrelatoValue | null) => void
  locked?: boolean
  placeholder?: string
  disabled?: boolean
  /** Se presente, limita i risultati mostrati/selezionabili a questi tipi. */
  allowedTipi?: CorrelatoTipo[]
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CorrelatoValue[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (locked) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [locked])

  useEffect(() => {
    if (locked) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search/correlabili?q=${encodeURIComponent(q)}&limit=10`)
        .then((res) => {
          if (!res.ok) throw new Error("Ricerca non riuscita")
          return res.json() as Promise<{ results: CorrelatoValue[] }>
        })
        .then((data) =>
          setResults(
            allowedTipi
              ? data.results.filter((r) => allowedTipi.includes(r.tipo))
              : data.results,
          ),
        )
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, locked, allowedTipi])

  if (locked) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
        {value ? (
          <>
            <Badge className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy">
              {TIPO_LABEL[value.tipo]}
            </Badge>
            <span className="truncate font-medium text-foreground">{value.nome}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Nessun record collegato</span>
        )}
      </div>
    )
  }

  const grouped: Record<CorrelatoTipo, CorrelatoValue[]> = {
    lead: [],
    cliente: [],
    scadenza: [],
  }
  for (const r of results) grouped[r.tipo].push(r)

  return (
    <div ref={containerRef} className="relative">
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <Badge className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy">
            {TIPO_LABEL[value.tipo]}
          </Badge>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {value.nome}
          </span>
          {!disabled ? (
            <button
              type="button"
              aria-label="Rimuovi collegamento"
              onClick={() => {
                onSelect(null)
                setQuery("")
              }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconX size={15} stroke={1.8} />
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="relative">
            <IconSearch
              size={15}
              stroke={1.8}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="pl-8"
            />
            {loading ? (
              <IconLoader2
                size={15}
                stroke={1.8}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            ) : null}
          </div>
          {open && query.trim() ? (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-md">
              {TIPO_ORDER.map((tipo) =>
                grouped[tipo].length > 0 ? (
                  <div key={tipo} className="flex flex-col">
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {TIPO_LABEL[tipo]}
                    </span>
                    {grouped[tipo].map((r) => (
                      <button
                        key={`${r.tipo}-${r.id}`}
                        type="button"
                        onClick={() => {
                          onSelect(r)
                          setQuery("")
                          setOpen(false)
                        }}
                        className="flex items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                      >
                        <span className="truncate">{r.nome}</span>
                      </button>
                    ))}
                  </div>
                ) : null,
              )}
              {!loading && results.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Nessun risultato
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
