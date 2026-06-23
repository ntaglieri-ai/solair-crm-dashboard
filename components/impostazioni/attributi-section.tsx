"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  IconPlus,
  IconTrash,
  IconGripVertical,
  IconLock,
  IconX,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockAttributiRecord,
  ATTRIBUTI_MODULI,
  MODULO_SEZIONI,
  CAMPO_TIPI,
  type RecordField,
  type CampoTipo,
  type AuditModulo,
} from "@/lib/mock-data"
import { SectionHeader } from "@/components/impostazioni/settings-ui"

function TipoBadge({ tipo }: { tipo: CampoTipo }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground">
      {tipo}
    </span>
  )
}

function NewFieldDialog({
  open,
  onOpenChange,
  sezioni,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  sezioni: string[]
  onCreate: (f: RecordField) => void
}) {
  const [nome, setNome] = useState("")
  const [tipo, setTipo] = useState<CampoTipo>("Testo")
  const [sezione, setSezione] = useState(sezioni[0])
  const [opzioni, setOpzioni] = useState<string[]>([])
  const [nuovaOpzione, setNuovaOpzione] = useState("")

  const reset = () => {
    setNome("")
    setTipo("Testo")
    setSezione(sezioni[0])
    setOpzioni([])
    setNuovaOpzione("")
  }

  const addOpzione = () => {
    const v = nuovaOpzione.trim()
    if (!v) return
    setOpzioni((prev) => [...prev, v])
    setNuovaOpzione("")
  }

  const valid =
    nome.trim() && (tipo !== "Lista a tendina" || opzioni.length > 0)

  const submit = () => {
    if (!valid) return
    onCreate({
      id: `f-${Date.now()}`,
      nome: nome.trim(),
      tipo,
      sezione,
      attivo: true,
      sistema: false,
      opzioni: tipo === "Lista a tendina" ? opzioni : undefined,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi campo personalizzato</DialogTitle>
          <DialogDescription>
            Il nuovo campo sarà disponibile nei record del modulo selezionato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-nome">Nome campo</Label>
            <Input
              id="f-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Numero contratto"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as CampoTipo)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CAMPO_TIPI.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Sezione</Label>
              <Select value={sezione} onValueChange={setSezione}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sezioni.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "Lista a tendina" ? (
            <div className="flex flex-col gap-2">
              <Label>Opzioni</Label>
              <div className="flex flex-wrap gap-1.5">
                {opzioni.map((o, i) => (
                  <span
                    key={`${o}-${i}`}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground"
                  >
                    {o}
                    <button
                      type="button"
                      aria-label={`Rimuovi ${o}`}
                      onClick={() =>
                        setOpzioni((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <IconX size={13} stroke={2} />
                    </button>
                  </span>
                ))}
                {opzioni.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Nessuna opzione aggiunta.
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={nuovaOpzione}
                  onChange={(e) => setNuovaOpzione(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addOpzione()
                    }
                  }}
                  placeholder="Aggiungi valore"
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOpzione}
                >
                  Aggiungi
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Aggiungi campo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AttributiSection() {
  const [modulo, setModulo] = useState<AuditModulo>("Lead")
  const [fieldsByModule, setFieldsByModule] = useState<
    Record<string, RecordField[]>
  >(mockAttributiRecord)
  const [addOpen, setAddOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const fields = fieldsByModule[modulo] ?? []
  const systemFields = fields.filter((f) => f.sistema)
  const customFields = fields.filter((f) => !f.sistema)
  const sezioni = MODULO_SEZIONI[modulo] ?? ["Altro"]

  const updateFields = (updater: (prev: RecordField[]) => RecordField[]) =>
    setFieldsByModule((prev) => ({ ...prev, [modulo]: updater(prev[modulo] ?? []) }))

  const toggleVisible = (id: string) =>
    updateFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, visibile: !f.visibile } : f)),
    )

  const toggleActive = (id: string) =>
    updateFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, attivo: !f.attivo } : f)),
    )

  const removeField = (id: string) =>
    updateFields((prev) => prev.filter((f) => f.id !== id))

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    updateFields((prev) => {
      const sys = prev.filter((f) => f.sistema)
      const custom = prev.filter((f) => !f.sistema)
      const from = custom.findIndex((f) => f.id === dragId)
      const to = custom.findIndex((f) => f.id === targetId)
      if (from < 0 || to < 0) return prev
      const next = [...custom]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return [...sys, ...next]
    })
    setDragId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Attributi record"
        description="Configura i campi di sistema e personalizzati per ogni modulo del CRM."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus size={16} stroke={2} data-icon="inline-start" />
            Aggiungi campo
          </Button>
        }
      />

      <div className="flex flex-col gap-1.5">
        <Label>Modulo</Label>
        <Select
          value={modulo}
          onValueChange={(v) => setModulo(v as AuditModulo)}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ATTRIBUTI_MODULI.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Campi di sistema */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Campi di sistema
        </h3>
        <Card className="flex flex-col gap-1 p-2">
          {systemFields.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                <IconLock size={15} stroke={1.8} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {f.nome}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {f.sezione}
                </span>
              </div>
              <TipoBadge tipo={f.tipo} />
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Visibile
                </span>
                <Switch
                  checked={f.visibile ?? true}
                  onCheckedChange={() => toggleVisible(f.id)}
                  aria-label={`Visibilità ${f.nome}`}
                />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Campi personalizzati */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Campi personalizzati
        </h3>
        {customFields.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nessun campo personalizzato per questo modulo.
          </Card>
        ) : (
          <Card className="flex flex-col gap-1 p-2">
            {customFields.map((f) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => setDragId(f.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(f.id)}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  "flex cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-2 transition-shadow active:cursor-grabbing",
                  dragId === f.id && "opacity-50",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                  <IconGripVertical size={16} stroke={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {f.nome}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {f.sezione}
                  </span>
                </div>
                <TipoBadge tipo={f.tipo} />
                <Switch
                  checked={f.attivo}
                  onCheckedChange={() => toggleActive(f.id)}
                  aria-label={`Attiva ${f.nome}`}
                />
                <button
                  type="button"
                  aria-label={`Elimina ${f.nome}`}
                  onClick={() => {
                    removeField(f.id)
                    toast.success("Campo eliminato", { description: f.nome })
                  }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <IconTrash size={15} stroke={1.8} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <NewFieldDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        sezioni={sezioni}
        onCreate={(f) => {
          updateFields((prev) => [...prev, f])
          toast.success("Campo aggiunto", { description: f.nome })
        }}
      />
    </div>
  )
}
