import { NextResponse } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { insertCollegamento } from "@/lib/allegati/repository"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"
import { canAccessCrmRecord } from "@/lib/permissions/data-scope"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: unknown): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    titolo?: string
    url?: string
    recordTipo?: string
    recordId?: string
  } | null

  const titolo = body?.titolo?.trim()
  const url = body?.url?.trim()
  const recordTipo = body?.recordTipo
  const recordId = body?.recordId

  if (!titolo || !url || !isValidTipo(recordTipo) || !recordId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
  }
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: "URL non valido" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "edit")
  if (guard.response) return guard.response
  if (!(await canAccessCrmRecord(guard.permissions.snapshot, recordTipo, recordId))) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 })
  }

  const permissions = await getCurrentPermissions()
  const utenteId = permissions.snapshot.subject.userId
  if (!utenteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const collegamento = await insertCollegamento({
      titolo,
      url,
      record_id: recordId,
      record_tipo: recordTipo,
      creato_da: utenteId,
    })
    return NextResponse.json({ collegamento }, { status: 201 })
  } catch (error) {
    console.error("[allegati/link] insert fallito:", error)
    return NextResponse.json({ error: "Errore nel salvataggio del collegamento" }, { status: 500 })
  }
}
