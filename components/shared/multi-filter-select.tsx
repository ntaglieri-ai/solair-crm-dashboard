"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type MultiFilterOption = {
  value: string
  label: string
}

export function MultiFilterSelect({
  value,
  onValueChange,
  options,
  allLabel,
  ariaLabel,
  className,
  disabled,
}: {
  value: string[]
  onValueChange: (value: string[]) => void
  options: MultiFilterOption[]
  allLabel: string
  ariaLabel: string
  className?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const selected = useMemo(() => new Set(value), [value])
  const selectedOptions = options.filter((option) => selected.has(option.value))
  const q = query.trim().toLowerCase()
  const visibleOptions = q
    ? options.filter((option) => option.label.toLowerCase().includes(q))
    : options
  const label =
    selectedOptions.length === 0
      ? allLabel
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selezionati`

  const toggle = (optionValue: string) => {
    onValueChange(
      selected.has(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full justify-between gap-2 bg-card px-3 text-left font-medium",
              selectedOptions.length === 0 && "text-muted-foreground",
              className,
            )}
            aria-label={ariaLabel}
            disabled={disabled}
          />
        }
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0 opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
        {options.length > 8 ? (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 bg-card pl-8"
              aria-label={`${ariaLabel}: cerca`}
            />
          </div>
        ) : null}
        <div className="max-h-72 overflow-y-auto pr-1">
          {visibleOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
            >
              <Checkbox
                checked={selected.has(option.value)}
                onCheckedChange={() => toggle(option.value)}
              />
              <span className="min-w-0 truncate">{option.label}</span>
            </label>
          ))}
          {visibleOptions.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Nessun valore</p>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onValueChange([])}
            disabled={selectedOptions.length === 0}
          >
            <X data-icon="inline-start" />
            Pulisci
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
