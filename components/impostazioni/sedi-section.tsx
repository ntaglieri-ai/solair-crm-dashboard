"use client"

import { useState } from "react"
import { toast } from "sonner"
import { IconMapPin, IconPencil, IconCheck, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockSediConfig,
  mockCommerciali,
  type SediConfig,
} from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

function SedeCard({
  sede,
  onSave,
}: {
  sede: SediConfig
  onSave: (s: SediConfig) => void
}) {
  const [editing, setEditing] = useState(false)
  const [indirizzo, setIndirizzo] = useState(sede.indirizzo)
  const [responsabile, setResponsabile] = useState(sede.responsabile)
  const [attiva, setAttiva] = useState(sede.attiva)

  const cancel = () => {
    setIndirizzo(sede.indirizzo)
    setResponsabile(sede.responsabile)
    setAttiva(sede.attiva)
    setEditing(false)
  }

  const save = () => {
    onSave({ ...sede, indirizzo, responsabile, attiva })
    setEditing(false)
    toast.success("Sede aggiornata", { description: sede.nome })
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-navy/10 text-navy">
            <IconMapPin size={18} stroke={1.8} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">
              {sede.nome}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                attiva ? "text-success" : "text-muted-foreground",
              )}
            >
              {attiva ? "Attiva" : "Inattiva"}
            </span>
          </div>
        </div>
        {!editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={`Modifica sede ${sede.nome}`}
          >
            <IconPencil size={15} stroke={1.8} data-icon="inline-start" />
            Modifica
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`ind-${sede.id}`}>Indirizzo</Label>
            <Input
              id={`ind-${sede.id}`}
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Responsabile</Label>
            <Select value={responsabile} onValueChange={setResponsabile}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {mockCommerciali.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm font-medium text-foreground">
              Sede attiva
            </span>
            <Switch checked={attiva} onCheckedChange={setAttiva} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={cancel}>
              <IconX size={15} stroke={1.8} data-icon="inline-start" />
              Annulla
            </Button>
            <Button size="sm" onClick={save}>
              <IconCheck size={15} stroke={2} data-icon="inline-start" />
              Salva
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Indirizzo</span>
            <span className="text-sm text-foreground">{sede.indirizzo}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Responsabile</span>
            <span className="text-sm text-foreground">{sede.responsabile}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

export function SediSection() {
  const [sedi, setSedi] = useState<SediConfig[]>(mockSediConfig)

  const handleSave = (updated: SediConfig) =>
    setSedi((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Sedi"
        description="Gestisci le sedi operative di Solair, i responsabili e lo stato di attività."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {sedi.map((sede) => (
          <SedeCard key={sede.id} sede={sede} onSave={handleSave} />
        ))}
      </div>
    </div>
  )
}
