"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"
import type { Lead, ClienteRecord } from "@/lib/mock-data"
import { STATO_CLIENTE_VALUES } from "@/lib/mock-data"
import type { PermissionEngine } from "@/lib/permissions/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type EditField = {
  key: string
  label: string
  value: unknown
  type?: "text" | "email" | "tel" | "number" | "boolean" | "textarea" | "date" | "select"
  /** Solo per type "select": valori ammessi nella tendina. */
  options?: string[]
}

type EditValue = string | boolean

function fieldType(type: "text" | "numeric" | "boolean" | "timestamp") {
  if (type === "boolean") return "boolean"
  if (type === "numeric") return "number"
  // Prima cadeva su "text": l'utente scriveva una data in formato libero
  // (es. "26/08/2026"), il server la mandava cosi' com'era a Postgres, che
  // la rifiutava — e l'errore veniva mascherato da un generico "non
  // trovato" (vedi outgoingEditValue e la route PATCH). Con l'input nativo
  // date il browser garantisce sempre YYYY-MM-DD in uscita.
  if (type === "timestamp") return "date"
  return "text"
}

function initialEditValue(field: EditField): EditValue {
  if (field.type === "boolean") return field.value === true
  if (field.value === null || field.value === undefined) return ""
  if (field.type === "date") {
    // L'input nativo type="date" richiede esattamente YYYY-MM-DD: un
    // timestamp ISO completo (es. "2026-08-26T10:00:00+00:00") non renderizza
    // correttamente il valore preselezionato.
    const iso = String(field.value)
    return iso.length >= 10 ? iso.slice(0, 10) : iso
  }
  return String(field.value)
}

function outgoingEditValue(field: EditField, value: EditValue) {
  if (field.type === "boolean") return value === true
  if (field.type === "number") {
    const text = String(value).trim()
    if (!text) return null
    const number = Number(text)
    return Number.isFinite(number) ? number : null
  }
  if (field.type === "date") {
    const text = String(value).trim()
    // Campo svuotato = azzera la data. L'input nativo garantisce sempre
    // YYYY-MM-DD quando non e' vuoto, quindi qui non serve validare il
    // formato: e' esattamente cio' che Postgres si aspetta per un timestamp.
    return text ? text : null
  }
  return String(value)
}

function isLongField(label: string) {
  return /descrizione|note|materiali|assistenza|stratigrafia/i.test(label)
}

function isEditableRuntimeValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
}

export function buildLeadEditFields(
  lead: Lead,
  permissions: PermissionEngine,
): EditField[] {
  return LEAD_RECORD_FIELDS
    .filter((field) => permissions.canField("lead", field.column, "edit"))
    .map((field) => ({
      key: String(field.appField),
      label: String(field.appField),
      value: lead[field.appField],
      type: isLongField(String(field.appField))
        ? "textarea"
        : fieldType(field.type),
    }))
}

export function buildClienteEditFields(
  cliente: ClienteRecord,
  permissions: PermissionEngine,
  // Report Vito (11, 12): Stato e Installatore erano testo libero nel form
  // di modifica anche se le tendine "vere" esistono gia' altrove nell'app
  // (menu contestuale riga, filtri). installerNames = valori reali distinti
  // gia' presenti sui clienti, stessa fonte usata per il filtro (bug 4/12).
  installerNames: string[],
): EditField[] {
  return CLIENTI_RECORD_FIELDS
    .filter((field) => permissions.canField("clienti", field.column, "edit"))
    .filter((field) => isEditableRuntimeValue(cliente[field.appField as keyof ClienteRecord]))
    .map((field) => {
      if (field.appField === "Stato") {
        return {
          key: field.appField,
          label: field.appField,
          value: cliente[field.appField as keyof ClienteRecord],
          type: "select" as const,
          options: STATO_CLIENTE_VALUES,
        }
      }
      if (field.appField === "Installatore") {
        return {
          key: field.appField,
          label: field.appField,
          value: cliente[field.appField as keyof ClienteRecord],
          type: "select" as const,
          options: installerNames,
        }
      }
      return {
        key: field.appField,
        label: field.appField,
        value: cliente[field.appField as keyof ClienteRecord],
        type: isLongField(field.appField) ? "textarea" as const : fieldType(field.type),
      }
    })
}

/**
 * Drawer/dialog generico per il pulsante "Modifica" su Lead/Cliente/
 * Scadenza: modifica piu' campi insieme in un colpo solo, poi PATCH e
 * router.refresh() (i dati arrivano da un componente server, non serve
 * sollevare stato tra i componenti come per il dialog compito).
 */
export function EditRecordDialog({
  open,
  onOpenChange,
  title,
  fields,
  endpoint,
  buildBody = (values) => values,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: EditField[]
  endpoint: string
  /** Mappa i valori del form (per key) nel body atteso dall'API PATCH. */
  buildBody?: (values: Record<string, unknown>) => Record<string, unknown>
  onSaved?: () => void
}) {
  const valueSignature = JSON.stringify(fields.map((field) => [field.key, field.value, field.type]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EditRecordDialogBody
          key={valueSignature}
          fields={fields}
          endpoint={endpoint}
          buildBody={buildBody}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditRecordDialogBody({
  fields,
  endpoint,
  buildBody,
  onOpenChange,
  onSaved,
}: {
  fields: EditField[]
  endpoint: string
  buildBody: (values: Record<string, unknown>) => Record<string, unknown>
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.key, initialEditValue(field)])),
    [fields],
  )
  const [values, setValues] = useState<Record<string, EditValue>>(initialValues)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSave() {
    const changed = Object.fromEntries(
      fields
        .filter((field) => values[field.key] !== initialValues[field.key])
        .map((field) => [
          field.key,
          outgoingEditValue(field, values[field.key] ?? ""),
        ]),
    )

    if (Object.keys(changed).length === 0) {
      onOpenChange(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(changed)),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? "Salvataggio non riuscito")
      }
      toast.success("Modifiche salvate")
      onOpenChange(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
        <div className="grid max-h-[min(68dvh,720px)] grid-cols-1 gap-4 overflow-y-auto pr-1 py-1 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div
              key={field.key}
              className={field.type === "textarea" ? "flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3" : "flex flex-col gap-1.5"}
            >
              {field.type === "boolean" ? (
                <label
                  htmlFor={`edit-${field.key}`}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm"
                >
                  <Checkbox
                    id={`edit-${field.key}`}
                    checked={values[field.key] === true}
                    onCheckedChange={(checked) =>
                      setValues((prev) => ({ ...prev, [field.key]: checked === true }))
                    }
                  />
                  <span>{field.label}</span>
                </label>
              ) : (
                <>
                  <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`edit-${field.key}`}
                      value={String(values[field.key] ?? "")}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="min-h-28"
                    />
                  ) : field.type === "select" ? (
                    <Select
                      value={String(values[field.key] ?? "")}
                      onValueChange={(v) =>
                        setValues((prev) => ({ ...prev, [field.key]: v ?? "" }))
                      }
                    >
                      <SelectTrigger id={`edit-${field.key}`} className="w-full">
                        <SelectValue placeholder={`Seleziona ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`edit-${field.key}`}
                      type={field.type ?? "text"}
                      step={field.type === "number" ? "any" : undefined}
                      value={String(values[field.key] ?? "")}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva modifiche"}
          </Button>
        </DialogFooter>
    </>
  )
}
