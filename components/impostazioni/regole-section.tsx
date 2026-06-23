"use client"

import { useState } from "react"
import {
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconLock,
  IconUserCheck,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  mockRegoleAssegnazione,
  mockUtenti,
  ORIGINE_LEAD_VALUES,
  SEDE_LABELS,
  type SettingsAssignmentRule,
  type SettingsRuleCondition,
} from "@/lib/mock-data"
import { SectionHeader } from "./settings-ui"

const FIELD_OPTIONS: SettingsRuleCondition["field"][] = ["Origine Lead", "Sede"]
const OP_OPTIONS: SettingsRuleCondition["op"][] = ["è", "contiene", "inizia con"]

function valueOptions(field: SettingsRuleCondition["field"]): string[] {
  return field === "Origine Lead"
    ? [...ORIGINE_LEAD_VALUES]
    : [...SEDE_LABELS]
}

export function RegoleSection() {
  const [rules, setRules] = useState<SettingsAssignmentRule[]>(
    mockRegoleAssegnazione,
  )
  const assegnatari = mockUtenti
    .filter((u) => u.attivo)
    .map((u) => u.nome)

  function reorder(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rules.length) return
    if (rules[index].locked || rules[target].locked) return
    const next = [...rules]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRules(next.map((r, i) => ({ ...r, priorita: i + 1 })))
  }

  function addRule() {
    const lockedIdx = rules.findIndex((r) => r.locked)
    const newRule: SettingsAssignmentRule = {
      id: `sr-${Date.now()}`,
      priorita: 0,
      nome: "Nuova regola",
      conditions: [{ field: "Origine Lead", op: "è", value: ORIGINE_LEAD_VALUES[0] }],
      assegnaA: assegnatari[0] ?? "",
      attiva: true,
    }
    const next = [...rules]
    const insertAt = lockedIdx === -1 ? next.length : lockedIdx
    next.splice(insertAt, 0, newRule)
    setRules(next.map((r, i) => ({ ...r, priorita: i + 1 })))
  }

  function updateRule(id: string, patch: Partial<SettingsAssignmentRule>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRule(id: string) {
    setRules((prev) =>
      prev
        .filter((r) => r.id !== id)
        .map((r, i) => ({ ...r, priorita: i + 1 })),
    )
  }

  function updateCondition(
    ruleId: string,
    condIdx: number,
    patch: Partial<SettingsRuleCondition>,
  ) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r
        const conditions = r.conditions.map((c, i) => {
          if (i !== condIdx) return c
          const merged = { ...c, ...patch }
          // Se cambia il campo, reimposta un valore coerente.
          if (patch.field && patch.field !== c.field) {
            merged.value = valueOptions(patch.field)[0]
          }
          return merged
        })
        return { ...r, conditions }
      }),
    )
  }

  function addCondition(ruleId: string) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              conditions: [
                ...r.conditions,
                { field: "Sede", op: "è", value: SEDE_LABELS[0] },
              ],
            }
          : r,
      ),
    )
  }

  function removeCondition(ruleId: string, condIdx: number) {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, conditions: r.conditions.filter((_, i) => i !== condIdx) }
          : r,
      ),
    )
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Regole di assegnazione"
        description="I lead in entrata vengono assegnati al primo commerciale la cui regola corrisponde, valutando le regole dall'alto verso il basso."
        action={
          <Button onClick={addRule}>
            <IconPlus className="size-4" />
            Nuova regola
          </Button>
        }
      />

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                  {rule.priorita}
                </span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Sposta su"
                    disabled={index === 0 || rule.locked}
                    onClick={() => reorder(index, -1)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <IconArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Sposta giù"
                    disabled={index === rules.length - 1 || rule.locked}
                    onClick={() => reorder(index, 1)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    <IconArrowDown className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                {rule.locked ? (
                  <div className="flex items-center gap-2">
                    <IconLock className="size-4 text-muted-foreground" />
                    <span className="font-medium">{rule.nome}</span>
                    <Badge tone="muted">Fallback</Badge>
                  </div>
                ) : (
                  <Input
                    value={rule.nome}
                    onChange={(e) => updateRule(rule.id, { nome: e.target.value })}
                    className="h-9 max-w-xs font-medium"
                    aria-label="Nome regola"
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <IconUserCheck className="size-4 text-muted-foreground" />
                  <Select
                    value={rule.assegnaA}
                    onValueChange={(v) => updateRule(rule.id, { assegnaA: v })}
                  >
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue placeholder="Assegna a" />
                    </SelectTrigger>
                    <SelectContent>
                      {assegnatari.map((nome) => (
                        <SelectItem key={nome} value={nome}>
                          {nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Switch
                  checked={rule.attiva}
                  onCheckedChange={(v) => updateRule(rule.id, { attiva: v })}
                  aria-label="Regola attiva"
                />
                {!rule.locked ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground hover:text-destructive"
                    aria-label="Elimina regola"
                    onClick={() => removeRule(rule.id)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Condizioni */}
            {!rule.locked ? (
              <div className="mt-4 space-y-2 border-t border-border pt-4 pl-10">
                <Label className="text-xs text-muted-foreground">
                  Condizioni (tutte devono essere soddisfatte)
                </Label>
                {rule.conditions.map((cond, ci) => (
                  <div key={ci} className="flex flex-wrap items-center gap-2">
                    <Select
                      value={cond.field}
                      onValueChange={(v) =>
                        updateCondition(rule.id, ci, {
                          field: v as SettingsRuleCondition["field"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.op}
                      onValueChange={(v) =>
                        updateCondition(rule.id, ci, {
                          op: v as SettingsRuleCondition["op"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OP_OPTIONS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.value}
                      onValueChange={(v) =>
                        updateCondition(rule.id, ci, { value: v })
                      }
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {valueOptions(cond.field).map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rule.conditions.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="Rimuovi condizione"
                        onClick={() => removeCondition(rule.id, ci)}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => addCondition(rule.id)}
                >
                  <IconPlus className="size-3.5" />
                  Aggiungi condizione
                </Button>
              </div>
            ) : (
              <p className="mt-3 pl-10 text-sm text-muted-foreground">
                Applicata a tutti i lead che non corrispondono ad altre regole.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
