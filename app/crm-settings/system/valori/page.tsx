"use client"

import { useEffect, useState } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SectionHeader, ColorDot } from "@/components/impostazioni/settings-ui"
import { cn } from "@/lib/utils"
import {
  valoriPerModulo,
  MODULI_VALORI,
  type ModuloValori,
  type CampoValori,
  type ValoreConfig,
} from "@/lib/system-settings-data"
import { usePermissions } from "@/lib/permissions/provider"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"
import { tableForCrmModule, valueKeyFromLabel } from "@/lib/crm-settings/schema-admin"

function SortableValore({
  valore,
  onDelete,
  disabled,
}: {
  valore: ValoreConfig
  onDelete: () => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: valore.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "text-muted-foreground",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-grab hover:text-foreground active:cursor-grabbing",
        )}
        aria-label="Trascina per riordinare"
        {...(disabled ? {} : attributes)}
        {...(disabled ? {} : listeners)}
      >
        <GripVertical className="size-4" />
      </button>
      <ColorDot color={valore.colore} />
      <span className="flex-1 text-sm font-medium text-foreground">
        {valore.etichetta}
      </span>
      <Input
        value={valore.etichetta}
        readOnly
        className="h-8 w-40 bg-muted text-xs text-muted-foreground"
        aria-label="Valore"
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Elimina ${valore.etichetta}`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

function CampoAccordion({
  campo,
  onReorder,
  onAdd,
  onDelete,
  disabled,
}: {
  campo: CampoValori
  onReorder: (campoNome: string, ids: string[]) => void
  onAdd: (campoNome: string) => void
  onDelete: (campoNome: string, id: string) => void
  disabled: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (disabled || !over || active.id === over.id) return
    const oldIndex = campo.valori.findIndex((v) => v.id === active.id)
    const newIndex = campo.valori.findIndex((v) => v.id === over.id)
    const next = arrayMove(campo.valori, oldIndex, newIndex)
    onReorder(
      campo.campo,
      next.map((v) => v.id),
    )
  }

  return (
    <AccordionItem value={campo.campo}>
      <AccordionTrigger>
        <span className="flex items-center gap-2">
          {campo.etichetta}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {campo.valori.length}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={campo.valori.map((v) => v.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {campo.valori.map((valore) => (
                  <SortableValore
                    key={valore.id}
                    valore={valore}
                    disabled={disabled}
                    onDelete={() => onDelete(campo.campo, valore.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => onAdd(campo.campo)}
            disabled={disabled}
          >
            <Plus className="size-4" />
            Aggiungi valore
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

const PALETTE = ["#3b82f6", "#2e8b72", "#f59e0b", "#dc2626", "#8b5cf6", "#94a3b8"]

export default function ValoriPage() {
  const permissions = usePermissions()
  const [modulo, setModulo] = useState<ModuloValori>("Lead")
  const [tutti, setTutti, store] = usePersistentSystemSetting<
    Record<ModuloValori, CampoValori[]>
  >(
    "system.valori",
    structuredClone(valoriPerModulo),
  )
  const [newValueField, setNewValueField] = useState<string | null>(null)
  const [newValueLabel, setNewValueLabel] = useState("")
  const [newValueColor, setNewValueColor] = useState(PALETTE[0])
  const [apiError, setApiError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("module")
    const selected = MODULI_VALORI.find(
      (module) => module.toLowerCase() === requested?.toLowerCase(),
    )
    if (selected) queueMicrotask(() => setModulo(selected))
  }, [])

  const campi = tutti[modulo]
  const selectedField = campi.find((campo) => campo.campo === newValueField)
  const canManageDefaultValues = permissions.canAction(
    "crm_settings.system.default_values.manage",
  )

  async function reorder(campoNome: string, ids: string[]) {
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].map((c) =>
        c.campo === campoNome
          ? {
              ...c,
              valori: ids.map((id) => c.valori.find((v) => v.id === id)!),
            }
          : c,
        ),
    }))
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/default-values", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: modulo, field: campoNome, order: ids }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Riordino valori non riuscito.")
    }
  }

  function addValore(campoNome: string) {
    if (!canManageDefaultValues) return
    const campo = campi.find((item) => item.campo === campoNome)
    setNewValueField(campoNome)
    setNewValueLabel("")
    setNewValueColor(PALETTE[(campo?.valori.length ?? 0) % PALETTE.length])
  }

  async function saveValore() {
    if (!newValueField || !newValueLabel.trim()) return
    setPending(true)
    setApiError(null)
    const response = await fetch("/api/crm-settings/schema/default-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: modulo,
        field: newValueField,
        label: newValueLabel.trim(),
        color: newValueColor,
      }),
    })
    setPending(false)
    const body = (await response.json().catch(() => null)) as
      | { id?: string; error?: string }
      | null
    if (!response.ok || !body?.id) {
      setApiError(body?.error ?? "Creazione valore non riuscita.")
      return
    }
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].map((c) =>
        c.campo === newValueField
          ? {
              ...c,
              valori: [
                ...c.valori,
                {
                  id: body.id,
                  etichetta: newValueLabel.trim(),
                  colore: newValueColor,
                },
              ],
            }
          : c,
      ),
    }))
    setNewValueField(null)
    setNewValueLabel("")
  }

  async function deleteValore(campoNome: string, id: string) {
    if (!canManageDefaultValues) return
    const valore = campi
      .find((campo) => campo.campo === campoNome)
      ?.valori.find((item) => item.id === id)
    const params = new URLSearchParams({ module: modulo, field: campoNome })
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      params.set("id", id)
    } else if (valore) {
      params.set("value", valueKeyFromLabel(valore.etichetta))
    }

    setPending(true)
    setApiError(null)
    const response = await fetch(`/api/crm-settings/schema/default-values?${params}`, {
      method: "DELETE",
    })
    setPending(false)
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setApiError(body?.error ?? "Eliminazione valore non riuscita.")
      return
    }
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].map((c) =>
        c.campo === campoNome
          ? { ...c, valori: c.valori.filter((v) => v.id !== id) }
          : c,
      ),
    }))
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Valori predefiniti"
        description={
          pending || store.saving
            ? "Salvataggio valori CRM..."
            : `Gestisci opzioni reali per le colonne configurabili di ${tableForCrmModule(modulo) ?? modulo}.`
        }
      />

      {apiError || store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {apiError ?? store.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {MODULI_VALORI.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModulo(m)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              modulo === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card px-4">
        <Accordion key={modulo} defaultValue={[campi[0]?.campo]}>
          {campi.map((campo) => (
            <CampoAccordion
              key={campo.campo}
              campo={campo}
              onReorder={reorder}
              onAdd={addValore}
              onDelete={deleteValore}
              disabled={!canManageDefaultValues || pending}
            />
          ))}
        </Accordion>
      </div>

      <Dialog
        open={newValueField !== null}
        onOpenChange={(open) => {
          if (!open) setNewValueField(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo valore predefinito</DialogTitle>
            <DialogDescription>
              {selectedField
                ? `Aggiungi una nuova opzione per ${selectedField.etichetta}.`
                : "Aggiungi una nuova opzione configurabile."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valore-etichetta">Etichetta</Label>
              <Input
                id="valore-etichetta"
                value={newValueLabel}
                onChange={(e) => setNewValueLabel(e.target.value)}
                placeholder="Es. Da richiamare"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewValueColor(color)}
                    className={cn(
                      "size-8 rounded-full border-2 transition-transform hover:scale-105",
                      newValueColor === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Seleziona colore ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewValueField(null)}>
              Annulla
            </Button>
            <Button
              onClick={saveValore}
              disabled={pending || !newValueLabel.trim()}
              className="bg-teal text-teal-foreground hover:bg-teal/90"
            >
              Aggiungi valore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
