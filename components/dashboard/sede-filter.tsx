"use client"

import { MapPin } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SEDI, type SedeId } from "@/lib/mock-data"

const SEDE_ITEMS = SEDI.reduce<Record<string, string>>((acc, sede) => {
  acc[sede.id] = sede.label
  return acc
}, {})

export function SedeFilter({
  value,
  onChange,
}: {
  value: SedeId
  onChange: (value: SedeId) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
        Vista per sede
      </span>
      <Select
        items={SEDE_ITEMS}
        value={value}
        onValueChange={(v) => onChange(v as SedeId)}
      >
        <SelectTrigger className="w-[200px] bg-card">
          <MapPin className="size-4 text-muted-foreground" />
          <SelectValue placeholder="Seleziona sede" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {SEDI.map((sede) => (
              <SelectItem key={sede.id} value={sede.id}>
                {sede.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
