"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconInfoCircle,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  mockValoriConfigurabili,
  type ConfigurableField,
  type ConfigurableValue,
  type AuditModulo,
} from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

const NEW_COLORS = ["#1e3a5f", "#2e8b72", "#f59e0b", "#3b82f6", "#dc2626", "#8b5cf6"]

export function ValoriSection() {
  const [data, setData] = useState<ConfigurableField[]>(mockValoriConfigurabili)
  const [moduloSel, setModuloSel] = useState<AuditModulo>("Lead")
  const [fieldId, setFieldId] = useState<string>(mockValoriConfigurabili[0].id)
  const [deleteTarget, setDeleteTarget] = useState<ConfigurableValue | null>(
    null,
  )
  const [dragId, setDragId] = useState<string | null>(null)

  const moduliDisponibili = useMemo(
    () => Array.from(new Set(data.map((f) => f.modulo))),
    [data],
  )
  const campiModulo = data.filter((f) => f.modulo === moduloSel)
  const field = data.find((f) => f.id === fieldId) ?? campiModulo[0]

  const updateField = (
    id: string,
    updater: (f: ConfigurableField) => ConfigurableField,
  ) => setData((prev) => prev.map((f) => (f.id === id ? updater(f) : f)))

  const setValueColor = (vid: string, color: string) =>
    updateField(fieldId, (f) => ({
      ...f,
      valori: f.valori.map((v) => (v.id === vid ? { ...v, color } : v)),
    }))

  const setValueName = (vid: string, nome: string) =>
    updateField(fieldId, (f) => ({
      ...f,
      valori: f.valori.map((v) => (v.id === vid ? { ...v, nome } : v)),
    }))

  const removeValue = (vid: string) =>
    updateField(fieldId, (f) => ({
      ...f,
      valori: f.valori.filter((v) => v.id !== vid),
    }))

  const addValue = () =>
    updateField(fieldId, (f) => ({
      ...f,
      valori: [
        ...f.valori,
        {
          id: `nv-${Date.now()}`,
          nome: "Nuovo valore",
          color: NEW_COLORS[f.valori.length % NEW_COLORS.length],
        },
      ],
    }))

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    updateField(fieldId, (f) => {
      const from = f.valori.findIndex((v) => v.id === dragId)
      const to = f.valori.findIndex((v) => v.id === targetId)
      if (from < 0 || to < 0) return f
      const next = [...f.valori]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { ...f, valori: next }
    })
    setDragId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Valori predefiniti"
        description="Gestisci gli elenchi a valori fissi (stati, priorità, origini) usati nei record."
      />

      {/* Selettori modulo + campo */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Modulo</Label>
          <Select
            value={moduloSel}
            onValueChange={(v) => {
              const m = v as AuditModulo
              setModuloSel(m)
              const first = data.find((f) => f.modulo === m)
              if (first) setFieldId(first.id)
            }}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {moduliDisponibili.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Campo</Label>
          <Select value={field?.id} onValueChange={(v) => setFieldId(v ?? "")}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue>{field?.campo}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {campiModulo.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.campo}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Avviso impatto */}
      <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2.5 text-sm text-foreground">
        <IconInfoCircle size={18} stroke={1.8} className="mt-0.5 shrink-0 text-info" />
        <span>
          Le modifiche ai valori impattano tutti i record esistenti che usano
          questo valore.
        </span>
      </div>

      {/* Lista valori */}
      {field ? (
        <Card className="flex flex-col gap-1 p-2">
          {field.valori.map((v) => (
            <div
              key={v.id}
              draggable
              onDragStart={() => setDragId(v.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(v.id)}
              onDragEnd={() => setDragId(null)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-shadow",
                dragId === v.id && "opacity-50",
              )}
            >
              <span className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing">
                <IconGripVertical size={16} stroke={1.8} />
              </span>

              {/* Color picker */}
              <label className="relative size-6 shrink-0 cursor-pointer">
                <span
                  className="block size-6 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: v.color }}
                />
                <input
                  type="color"
                  value={v.color}
                  onChange={(e) => setValueColor(v.id, e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  aria-label={`Colore di ${v.nome}`}
                />
              </label>

              <Input
                value={v.nome}
                onChange={(e) => setValueName(v.id, e.target.value)}
                className="h-9 flex-1"
                aria-label="Nome valore"
              />

              <button
                type="button"
                aria-label={`Elimina ${v.nome}`}
                onClick={() => setDeleteTarget(v)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <IconTrash size={15} stroke={1.8} />
              </button>
            </div>
          ))}

          <Button
            variant="outline"
            className="mt-1 border-dashed"
            onClick={addValue}
          >
            <IconPlus size={16} stroke={2} data-icon="inline-start" />
            Aggiungi valore
          </Button>
        </Card>
      ) : null}

      {/* Conferma eliminazione */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare il valore?</DialogTitle>
            <DialogDescription>
              Il valore{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.nome}
              </span>{" "}
              potrebbe essere in uso in alcuni record. L&apos;eliminazione è
              definitiva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  removeValue(deleteTarget.id)
                  toast.success("Valore eliminato", {
                    description: deleteTarget.nome,
                  })
                }
                setDeleteTarget(null)
              }}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
