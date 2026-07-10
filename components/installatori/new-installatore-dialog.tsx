"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useInstallatoriReferenceData } from "@/lib/installatori/hooks"
import type { InstallatoreRecord } from "@/lib/installatori/repository"
import { InstallatoreTagField } from "./installatore-tag-picker"

export function InstallatoreFormDialog({
  open,
  onOpenChange,
  installatore,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se presente, il dialog lavora in modalità modifica su questo installatore. */
  installatore?: InstallatoreRecord
  /** Callback di creazione — richiesto solo in modalità creazione. */
  onCreated?: (installatore: InstallatoreRecord) => void
}) {
  const router = useRouter()
  const { data: referenceData } = useInstallatoriReferenceData()
  const proprietari = useMemo(
    () => referenceData?.proprietari ?? [],
    [referenceData],
  )
  const tagSuggestions = referenceData?.tags ?? []
  const isEdit = Boolean(installatore)

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [emailSecondaria, setEmailSecondaria] = useState("")
  const [telefono, setTelefono] = useState("")
  const [tag, setTag] = useState("")
  const [attivo, setAttivo] = useState(true)
  const [proprietarioId, setProprietarioId] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setNome("")
    setEmail("")
    setEmailSecondaria("")
    setTelefono("")
    setTag("")
    setAttivo(true)
    setProprietarioId("")
    setNote("")
  }

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (installatore) {
        setNome(installatore.nome)
        setEmail(installatore.email ?? "")
        setEmailSecondaria(installatore.email_secondaria ?? "")
        setTelefono(installatore.telefono ?? "")
        setTag(installatore.tag ?? "")
        setAttivo(installatore.attivo)
        setProprietarioId(installatore.proprietario_id ?? "")
        setNote(installatore.note ?? "")
      } else {
        reset()
      }
    }
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installatore])

  const valid = nome.trim() !== ""

  const submit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    const payload = {
      nome: nome.trim(),
      email: email.trim() || null,
      email_secondaria: emailSecondaria.trim() || null,
      telefono: telefono.trim() || null,
      tag: tag.trim() || null,
      attivo,
      proprietario_id: proprietarioId || null,
      note: note.trim() || null,
    }
    try {
      if (isEdit && installatore) {
        const res = await fetch(`/api/installatori/${installatore.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Aggiornamento non riuscito")
        toast.success("Installatore aggiornato", { description: nome.trim() })
        onOpenChange(false)
        router.refresh()
      } else {
        const res = await fetch("/api/installatori", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Creazione non riuscita")
        const created = (await res.json()) as InstallatoreRecord
        toast.success("Installatore creato", { description: nome.trim() })
        onCreated?.(created)
        reset()
        onOpenChange(false)
        router.refresh()
      }
    } catch {
      toast.error(
        isEdit
          ? "Errore nell'aggiornamento dell'installatore"
          : "Errore nella creazione dell'installatore",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) return onOpenChange(o)
        if (!isEdit) reset()
        onOpenChange(false)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifica installatore" : "Nuovo installatore"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Aggiorna i dati dell'installatore."
              : "Inserisci i dati principali del nuovo installatore."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="inst-nome">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="inst-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. DG Impianti"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-email">E-mail</Label>
            <Input
              id="inst-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@azienda.it"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-email-sec">E-mail secondaria</Label>
            <Input
              id="inst-email-sec"
              type="email"
              value={emailSecondaria}
              onChange={(e) => setEmailSecondaria(e.target.value)}
              placeholder="alternativa@azienda.it"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inst-telefono">Telefono</Label>
            <Input
              id="inst-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+39 ..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tag</Label>
            <InstallatoreTagField value={tag} onChange={setTag} suggestions={tagSuggestions} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Stato</Label>
            <Select
              items={{ attivo: "Attivo", non_attivo: "Non attivo" }}
              value={attivo ? "attivo" : "non_attivo"}
              onValueChange={(v) => setAttivo(v === "attivo")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="attivo">Attivo</SelectItem>
                  <SelectItem value="non_attivo">Non attivo</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Proprietario</Label>
            <Select
              items={Object.fromEntries(proprietari.map((p) => [p.id, p.nome]))}
              value={proprietarioId}
              onValueChange={(v) => setProprietarioId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona proprietario" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {proprietari.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="inst-note">Note</Label>
            <Textarea
              id="inst-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Dettagli sull'installatore…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            disabled={!valid || submitting}
            onClick={submit}
          >
            {isEdit ? "Salva modifiche" : "Crea installatore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
