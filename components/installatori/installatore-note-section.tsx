"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NoteAttachmentList, RichNoteComposer, RichNoteText } from "@/components/shared/rich-note"
import type { NoteAttachment, NoteMention, NoteMentionDraft } from "@/lib/notes/mentions"
import { InstallatoreAvatar } from "./installatore-utils"

type Nota = {
  id: string
  autore: string
  quando: string
  testo: string
  menzioni?: NoteMention[]
  allegati?: NoteAttachment[]
}

export function InstallatoreNoteSection({
  installatoreId,
  nomeRecord,
}: {
  installatoreId: string
  nomeRecord: string
}) {
  const [note, setNote] = useState<Nota[]>([])
  const [nuova, setNuova] = useState("")
  const [menzioni, setMenzioni] = useState<NoteMentionDraft[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/installatori/${installatoreId}/notes`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { notes?: Array<{ id: string; testo: string; created_at: string; autore: string; menzioni?: NoteMention[]; allegati?: NoteAttachment[] }> }) => {
        if (cancelled) return
        setNote((body.notes ?? []).map((item) => ({
          id: item.id,
          autore: item.autore,
          quando: new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at)),
          testo: item.testo,
          menzioni: item.menzioni,
          allegati: item.allegati,
        })))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [installatoreId])

  async function aggiungi() {
    if (nuova.trim() === "" && files.length === 0) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("text", nuova)
      formData.append("mentions", JSON.stringify(menzioni))
      files.forEach((file) => formData.append("files", file))
      const response = await fetch(`/api/installatori/${installatoreId}/notes`, {
        method: "POST",
        body: formData,
      })
      if (!response.ok) throw new Error()
      const created = (await response.json()) as {
        id: string
        testo: string
        autore: string
        menzioni?: NoteMention[]
        allegati?: NoteAttachment[]
        notificationFailures?: number
        attachmentFailures?: number
      }
      setNote((prev) => [
        {
          id: created.id,
          autore: created.autore,
          quando: "adesso",
          testo: created.testo,
          menzioni: created.menzioni,
          allegati: created.allegati,
        },
        ...prev,
      ])
      setNuova("")
      setMenzioni([])
      setFiles([])
      toast.success("Nota aggiunta")
      if (created.notificationFailures) toast.warning("Nota salvata, ma una o più notifiche email non sono state inviate")
      if (created.attachmentFailures) toast.warning("Nota salvata, ma uno o più allegati non sono stati caricati")
    } catch {
      toast.error("Creazione nota non riuscita")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {note.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {note.map((n) => (
            <li key={n.id} className="flex gap-3">
              <InstallatoreAvatar nome={n.autore} className="size-8 text-[11px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{n.autore}</span>
                  <span className="text-[11px] text-muted-foreground">{n.quando}</span>
                </div>
                <RichNoteText text={n.testo} mentions={n.menzioni} className="text-[13px] text-foreground" />
                <NoteAttachmentList
                  allegati={n.allegati}
                  recordTipo="installatore"
                  recordId={installatoreId}
                  nomeRecord={nomeRecord}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <RichNoteComposer
          value={nuova}
          onChange={setNuova}
          mentions={menzioni}
          onMentionsChange={setMenzioni}
          files={files}
          onFilesChange={setFiles}
          rows={2}
          placeholder="Aggiungi nota..."
          className="bg-card text-[13px]"
          disabled={saving}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving || (nuova.trim() === "" && files.length === 0)}
            className="bg-teal text-teal-foreground hover:bg-teal/90"
            onClick={aggiungi}
          >
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </div>
      </div>
    </div>
  )
}
