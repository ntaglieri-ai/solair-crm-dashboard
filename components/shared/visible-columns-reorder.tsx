"use client"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Sequenza delle colonne visibili, riordinabile col trascinamento.
 *
 * Il trascinamento diretto sulle intestazioni della tabella esiste gia' e
 * resta il modo piu' rapido quando si sposta UNA colonna. Serve anche qui
 * perche' rimettere in fila una vista intera una colonna alla volta, sulla
 * tabella, significa inseguire intestazioni che scorrono in orizzontale:
 * in questo elenco stanno tutte sotto gli occhi.
 *
 * Mostra solo le colonne gia' spuntate sopra: e' l'ordine di
 * VISUALIZZAZIONE, non un secondo posto da cui sceglierle. Aggiungere o
 * togliere resta un'azione sola, la casella di spunta.
 *
 * Generico sull'id perche' Lead e Clienti hanno registri di colonne
 * separati e due copie divergerebbero al primo ritocco.
 */
export function VisibleColumnsReorder<Id extends string>({
  visible,
  labels,
  onChange,
}: {
  /** Colonne visibili, nell'ordine corrente. */
  visible: Id[]
  /** Etichetta da mostrare per ciascun id. */
  labels: Record<Id, string>
  onChange: (next: Id[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Senza una soglia, un clic fermo sulla maniglia parte come drag e
      // l'elenco "scatta" senza che l'utente abbia trascinato niente.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        Nessuna colonna visibile: spunta almeno una colonna qui sopra.
      </p>
    )
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = visible.indexOf(active.id as Id)
    const to = visible.indexOf(over.id as Id)
    if (from === -1 || to === -1) return
    onChange(arrayMove(visible, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={visible} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {visible.map((id, index) => (
            <SortableColumn
              key={id}
              id={id}
              label={labels[id] ?? id}
              position={index + 1}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableColumn<Id extends string>({
  id,
  label,
  position,
}: {
  id: Id
  label: string
  position: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-1.5",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
        aria-label={`Sposta ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {position}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {label}
      </span>
    </li>
  )
}
