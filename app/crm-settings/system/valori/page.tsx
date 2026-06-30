"use client"

import { useState } from "react"
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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
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

  const campi = tutti[modulo]
  const canManageDefaultValues = permissions.canAction(
    "crm_settings.system.default_values.manage",
  )

  function reorder(campoNome: string, ids: string[]) {
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
  }

  function addValore(campoNome: string) {
    if (!canManageDefaultValues) return
    const etichetta = window.prompt("Etichetta nuovo valore")
    if (!etichetta) return
    setTutti((prev) => ({
      ...prev,
      [modulo]: prev[modulo].map((c) =>
        c.campo === campoNome
          ? {
              ...c,
              valori: [
                ...c.valori,
                {
                  id: `v_${Date.now()}`,
                  etichetta,
                  colore: PALETTE[c.valori.length % PALETTE.length],
                },
              ],
            }
          : c,
      ),
    }))
  }

  function deleteValore(campoNome: string, id: string) {
    if (!canManageDefaultValues) return
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
        title="Valori configurabili"
        description={
          store.saving
            ? "Salvataggio configurazione..."
            : "Gestisci i valori delle select configurabili per ogni modulo e campo."
        }
      />

      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
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
              disabled={!canManageDefaultValues}
            />
          ))}
        </Accordion>
      </div>
    </div>
  )
}
