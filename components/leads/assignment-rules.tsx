"use client"

import { useState } from "react"
import {
  IconGripVertical,
  IconTrash,
  IconPlus,
  IconLock,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
  mockCommerciali,
} from "@/lib/mock-data"

export type RuleField = "Origine Lead" | "Sede" | "campaign name"
export type RuleOperator = "è" | "contiene"

export interface RuleCondition {
  field: RuleField
  op: RuleOperator
  value: string
}

export interface AssignmentRule {
  id: string
  name: string
  active: boolean
  /** La regola fallback non è riordinabile e resta sempre ultima. */
  locked?: boolean
  conditions: RuleCondition[]
  assignee: string
}

export const DEFAULT_RULES: AssignmentRule[] = [
  {
    id: "rule-fb-sicilia",
    name: "Lead Facebook Sicilia",
    active: true,
    conditions: [
      { field: "Origine Lead", op: "è", value: "Facebook" },
      { field: "Sede", op: "è", value: "Catania" },
    ],
    assignee: "Gaetano Grasso",
  },
  {
    id: "rule-veneto",
    name: "Lead Veneto",
    active: true,
    conditions: [{ field: "Sede", op: "è", value: "Treviso" }],
    assignee: "Mariarosa De Leo",
  },
  {
    id: "rule-fallback",
    name: "Fallback generale",
    active: true,
    locked: true,
    conditions: [],
    assignee: "Ivan Lo Faro",
  },
]

const FIELD_OPTIONS: RuleField[] = ["Origine Lead", "Sede", "campaign name"]

function criterionLabel(rule: AssignmentRule): string {
  if (rule.locked || rule.conditions.length === 0) return "Sempre vero"
  return rule.conditions
    .map((c) => `${c.field} ${c.op} ${c.value}`)
    .join(" e ")
}

function RuleCard({
  rule,
  index,
  dragging,
  onToggle,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  rule: AssignmentRule
  index: number
  dragging: boolean
  onToggle: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  return (
    <div
      draggable={!rule.locked}
      onDragStart={rule.locked ? undefined : onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2.5 transition-shadow",
        dragging && "opacity-50",
        !rule.locked && "cursor-grab active:cursor-grabbing",
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        {rule.locked ? (
          <IconLock size={15} stroke={1.8} />
        ) : (
          <IconGripVertical size={16} stroke={1.8} />
        )}
      </span>

      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">
          {rule.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {criterionLabel(rule)} → <span className="font-medium">{rule.assignee}</span>
        </span>
      </div>

      <Switch
        checked={rule.active}
        onCheckedChange={onToggle}
        aria-label={`Regola ${rule.name} attiva`}
      />

      {rule.locked ? (
        <span className="size-7 shrink-0" />
      ) : (
        <button
          type="button"
          aria-label={`Elimina regola ${rule.name}`}
          onClick={onDelete}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <IconTrash size={15} stroke={1.8} />
        </button>
      )}
    </div>
  )
}

function NewRuleDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreate: (rule: AssignmentRule) => void
}) {
  const [name, setName] = useState("")
  const [field, setField] = useState<RuleField>("Origine Lead")
  const [op, setOp] = useState<RuleOperator>("è")
  const [value, setValue] = useState("")
  const [assignee, setAssignee] = useState(mockCommerciali[0])
  const [active, setActive] = useState(true)

  const valueOptions =
    field === "Origine Lead"
      ? (ORIGINE_LEAD_VALUES as string[])
      : field === "Sede"
        ? (SEDE_LABELS as string[])
        : null

  const reset = () => {
    setName("")
    setField("Origine Lead")
    setOp("è")
    setValue("")
    setAssignee(mockCommerciali[0])
    setActive(true)
  }

  const valid = name.trim() && value.trim()

  const submit = () => {
    if (!valid) return
    onCreate({
      id: `rule-${Date.now()}`,
      name: name.trim(),
      active,
      conditions: [{ field, op, value: value.trim() }],
      assignee,
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova regola di assegnazione</DialogTitle>
          <DialogDescription>
            I lead che soddisfano la condizione verranno assegnati al commerciale
            indicato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-name">Nome regola</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Lead Facebook Sicilia"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Condizione</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Select
                value={field}
                onValueChange={(v) => {
                  setField(v as RuleField)
                  setValue("")
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FIELD_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={op} onValueChange={(v) => setOp(v as RuleOperator)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="è">è</SelectItem>
                    <SelectItem value="contiene">contiene</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {valueOptions ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Valore" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {valueOptions.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Valore"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Assegna a</Label>
            <Select value={assignee} onValueChange={setAssignee}>
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

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Regola attiva
              </span>
              <span className="text-xs text-muted-foreground">
                Disattivala per sospenderla senza eliminarla.
              </span>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Crea regola
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RulesSection() {
  const [rules, setRules] = useState<AssignmentRule[]>(DEFAULT_RULES)
  const [newOpen, setNewOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Le regole riordinabili sono quelle non bloccate; il fallback resta in fondo.
  const movable = rules.filter((r) => !r.locked)
  const locked = rules.filter((r) => r.locked)

  const toggle = (id: string) =>
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    )

  const remove = (id: string) =>
    setRules((prev) => prev.filter((r) => r.id !== id))

  const handleDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) return
    setRules(() => {
      const next = [...movable]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(target, 0, moved)
      return [...next, ...locked]
    })
    setDragIndex(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Le regole si applicano dall&apos;alto verso il basso: vince la prima che
        soddisfa la condizione. Trascina per cambiare la priorità.
      </p>

      <div className="flex flex-col gap-2">
        {movable.map((rule, i) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={i}
            dragging={dragIndex === i}
            onToggle={() => toggle(rule.id)}
            onDelete={() => remove(rule.id)}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          />
        ))}
        {locked.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={movable.length}
            dragging={false}
            onToggle={() => toggle(rule.id)}
            onDelete={() => {}}
            onDragStart={() => {}}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {}}
            onDragEnd={() => {}}
          />
        ))}
      </div>

      <Button
        variant="outline"
        className="mt-1 border-dashed"
        onClick={() => setNewOpen(true)}
      >
        <IconPlus size={16} stroke={2} data-icon="inline-start" />
        Nuova regola
      </Button>

      <NewRuleDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreate={(rule) =>
          setRules((prev) => {
            const movablePrev = prev.filter((r) => !r.locked)
            const lockedPrev = prev.filter((r) => r.locked)
            return [...movablePrev, rule, ...lockedPrev]
          })
        }
      />
    </div>
  )
}
