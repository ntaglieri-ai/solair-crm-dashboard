"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { initialEditValue, outgoingEditValue, type EditField } from "@/components/shared/edit-record-dialog"
import { usePermissions } from "@/lib/permissions/provider"
import type { FieldModuleKey } from "@/lib/permissions/field-catalog"
import { cn } from "@/lib/utils"

type InlineEditType = NonNullable<EditField["type"]>
type InlineEditValue = string | boolean

export type InlineEditableValueProps = {
  module: FieldModuleKey
  field: string
  label: string
  value: unknown
  endpoint: string
  patchKey: string
  type?: InlineEditType
  options?: string[]
  optionLabels?: Record<string, string>
  custom?: EditField["custom"]
  allowEmptyOption?: boolean
  emptyLabel?: string
  nullWhenEmpty?: boolean
  displayValue?: ReactNode
  className?: string
  valueClassName?: string
  onSaved?: () => void
}

function displayText(
  value: unknown,
  type: InlineEditType | undefined,
  emptyLabel: string,
  optionLabels?: Record<string, string>,
) {
  if (value === null || value === undefined || value === "") return emptyLabel
  if (type === "boolean") return value === true ? "Sì" : "No"
  if (type === "select" && typeof value === "string") return optionLabels?.[value] ?? value
  return String(value)
}

function fieldFromProps(props: InlineEditableValueProps): EditField {
  return {
    key: props.patchKey,
    label: props.label,
    value: props.value,
    type: props.type ?? "text",
    options: props.options,
    optionLabels: props.optionLabels,
    custom: props.custom,
  }
}

function normalizedOptions(
  options: string[] | undefined,
  current: InlineEditValue,
  optionLabels: Record<string, string> | undefined,
) {
  const values = [...(options ?? [])]
  const currentText = typeof current === "string" ? current : ""
  if (currentText && !values.includes(currentText)) values.unshift(currentText)
  return values.map((value) => ({ value, label: optionLabels?.[value] ?? value }))
}

export function InlineEditableValue(props: InlineEditableValueProps) {
  const resetKey = JSON.stringify([
    props.module,
    props.field,
    props.patchKey,
    props.type,
    props.value,
  ])
  return <InlineEditableValueInner key={resetKey} {...props} />
}

function InlineEditableValueInner(props: InlineEditableValueProps) {
  const permissions = usePermissions()
  const router = useRouter()
  const type = props.type ?? "text"
  const emptyLabel = props.emptyLabel ?? "—"
  const field = useMemo(() => fieldFromProps(props), [props])
  const initial = useMemo(() => initialEditValue(field), [field])
  const [currentValue, setCurrentValue] = useState(props.value)
  const [draft, setDraft] = useState<InlineEditValue>(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const canEdit =
    permissions.canRecord(props.module, "edit") &&
    permissions.canField(props.module, props.field, "edit")
  const canView = permissions.canField(props.module, props.field, "view")
  const options = normalizedOptions(props.options, draft, props.optionLabels)
  const renderedDisplay = currentValue === props.value ? props.displayValue : undefined

  if (!canView) return null

  async function saveValue(nextValue: InlineEditValue = draft) {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const freshField = { ...fieldFromProps(props), value: currentValue }
      const outgoing =
        props.nullWhenEmpty && nextValue === ""
          ? null
          : outgoingEditValue(freshField, nextValue)
      const res = await fetch(props.endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [props.patchKey]: outgoing }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Salvataggio non riuscito")
      }
      setCurrentValue(outgoing)
      setDraft(initialEditValue({ ...freshField, value: outgoing }))
      setEditing(false)
      toast.success("Campo aggiornato")
      props.onSaved?.()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setDraft(initialEditValue({ ...fieldFromProps(props), value: currentValue }))
    setEditing(false)
  }

  if (type === "boolean" && canEdit) {
    return (
      <span className={cn("inline-flex min-h-8 items-center gap-2", props.className)}>
        <Switch
          size="sm"
          checked={draft === true}
          disabled={saving}
          onCheckedChange={(checked) => {
            const next = checked === true
            setDraft(next)
            void saveValue(next)
          }}
          aria-label={`Modifica ${props.label}`}
        />
        <span className={cn("text-sm text-foreground", props.valueClassName)}>
          {draft === true ? "Sì" : "No"}
        </span>
        {saving ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </span>
    )
  }

  if (editing && canEdit) {
    return (
      <span className={cn("flex w-full min-w-0 items-start gap-1.5", props.className)}>
        <span className="min-w-0 flex-1">
          {type === "textarea" ? (
            <Textarea
              autoFocus
              value={String(draft ?? "")}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24"
            />
          ) : type === "select" ? (
            <Select
              items={Object.fromEntries(options.map((option) => [option.value, option.label]))}
              value={String(draft ?? "")}
              onValueChange={(value) => setDraft(value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={props.emptyLabel ?? "Nessuno"} />
              </SelectTrigger>
              <SelectContent>
                {props.allowEmptyOption ? (
                  <SelectItem value="">{props.emptyLabel ?? "Nessuno"}</SelectItem>
                ) : null}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              autoFocus
              type={type}
              step={type === "number" ? "any" : undefined}
              value={String(draft ?? "")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveValue()
                if (event.key === "Escape") cancelEdit()
              }}
            />
          )}
        </span>
        <Button size="icon" variant="ghost" className="size-8" disabled={saving} onClick={() => void saveValue()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          <span className="sr-only">Salva {props.label}</span>
        </Button>
        <Button size="icon" variant="ghost" className="size-8" disabled={saving} onClick={cancelEdit}>
          <X className="size-4" />
          <span className="sr-only">Annulla {props.label}</span>
        </Button>
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => canEdit && setEditing(true)}
      className={cn(
        "group inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md text-left text-sm text-foreground",
        canEdit && "cursor-text hover:bg-secondary/70",
        !canEdit && "cursor-default",
        props.className,
      )}
    >
      <span className={cn("min-w-0 truncate", props.valueClassName)}>
        {renderedDisplay ?? displayText(currentValue, type, emptyLabel, props.optionLabels)}
      </span>
      {canEdit ? (
        <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      ) : null}
    </button>
  )
}

export function InlineEditableField(props: InlineEditableValueProps) {
  return (
    <div className="min-w-0">
      <span className="block text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {props.label}
      </span>
      <div className="mt-1 min-w-0">
        <InlineEditableValue {...props} />
      </div>
    </div>
  )
}
