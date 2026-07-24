"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type EditField = {
  key: string
  label: string
  value: string
  type?: "text" | "email" | "tel"
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
  buildBody,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: EditField[]
  endpoint: string
  /** Mappa i valori del form (per key) nel body atteso dall'API PATCH. */
  buildBody: (values: Record<string, string>) => Record<string, unknown>
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(values)),
      })
      if (!res.ok) throw new Error("Salvataggio non riuscito")
      toast.success("Modifiche salvate")
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
              <Input
                id={`edit-${field.key}`}
                type={field.type ?? "text"}
                value={values[field.key] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
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
      </DialogContent>
    </Dialog>
  )
}
