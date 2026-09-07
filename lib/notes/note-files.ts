import { listFolder, uploadFile } from "@/lib/nextcloud/admin-webdav"
import {
  folderPathForRecord,
  nomeSenzaCollisioni,
  sanitizeName,
  type AllegatoRecordTipo,
} from "@/lib/allegati/paths"
import type { NoteAttachment, NoteMentionDraft } from "./mentions"

export type ParsedNotePayload = {
  text: string
  mentions: NoteMentionDraft[]
  files: File[]
}

function safeMentions(value: unknown): NoteMentionDraft[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (
          !item ||
          typeof item.userId !== "string" ||
          typeof item.start !== "number" ||
          typeof item.end !== "number"
        ) {
          return []
        }
        return [{ userId: item.userId, start: item.start, end: item.end }]
      })
    : []
}

export async function parseNotePayload(request: Request): Promise<ParsedNotePayload | null> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null)
    if (!formData) return null
    const rawMentions = formData.get("mentions")
    let mentions: unknown = []
    if (typeof rawMentions === "string" && rawMentions.trim()) {
      try {
        mentions = JSON.parse(rawMentions)
      } catch {
        mentions = []
      }
    }
    return {
      text: typeof formData.get("text") === "string" ? String(formData.get("text")).trim() : "",
      mentions: safeMentions(mentions),
      files: formData.getAll("files").filter((item): item is File => item instanceof File),
    }
  }

  const body = (await request.json().catch(() => null)) as
    | { text?: unknown; mentions?: unknown }
    | null
  return {
    text: typeof body?.text === "string" ? body.text.trim() : "",
    mentions: safeMentions(body?.mentions),
    files: [],
  }
}

export async function uploadNoteFiles(params: {
  recordTipo: AllegatoRecordTipo
  recordId: string
  nomeRecord: string
  noteId: string
  files: File[]
}): Promise<{ allegati: NoteAttachment[]; falliti: number }> {
  if (params.files.length === 0) return { allegati: [], falliti: 0 }

  const noteFolder = `${folderPathForRecord(
    params.recordTipo,
    params.recordId,
    params.nomeRecord,
  )}/Note/${params.noteId}`
  const listing = await listFolder(noteFolder)
  const existingNames = listing.ok
    ? listing.items.filter((item) => !item.isFolder).map((item) => item.nome)
    : []
  const allegati: NoteAttachment[] = []
  let falliti = 0

  for (const file of params.files) {
    const nomeBase = sanitizeName(file.name) || "allegato"
    const nome = nomeSenzaCollisioni(nomeBase, [
      ...existingNames,
      ...allegati.map((item) => item.nome),
    ])
    const path = `${noteFolder}/${nome}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFile(path, buffer, file.type || undefined)

    if (!result.ok) {
      falliti++
      console.error(
        `[note-files] upload ${params.recordTipo}/${params.recordId}/${params.noteId}/${nome} fallito:`,
        result.error ?? result.status,
      )
      continue
    }

    allegati.push({
      nome,
      path,
      byte: buffer.length,
      contentType: file.type || null,
    })
  }

  return { allegati, falliti }
}
