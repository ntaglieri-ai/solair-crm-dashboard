import { NextResponse } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { uploadFile } from "@/lib/nextcloud/admin-webdav"
import { filePathForRecord, type AllegatoRecordTipo } from "@/lib/allegati/paths"
import { listAllegati, insertDocumento } from "@/lib/allegati/repository"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: string | null): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recordTipo = searchParams.get("recordTipo")
  const recordId = searchParams.get("recordId")

  if (!isValidTipo(recordTipo) || !recordId) {
    return NextResponse.json({ error: "recordTipo e recordId richiesti" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "view")
  if (guard.response) return guard.response

  try {
    const result = await listAllegati(recordTipo, recordId)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[allegati] GET fallita:", error)
    return NextResponse.json({ error: "Errore nel recupero allegati" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")
  const recordTipo = formData.get("recordTipo") as string | null
  const recordId = formData.get("recordId") as string | null
  const nomeRecord = formData.get("nomeRecord") as string | null

  if (!(file instanceof File) || !isValidTipo(recordTipo) || !recordId || !nomeRecord) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "edit")
  if (guard.response) return guard.response

  const permissions = await getCurrentPermissions()
  const utenteId = permissions.snapshot.subject.userId
  if (!utenteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fullPath = filePathForRecord(recordTipo, recordId, nomeRecord, file.name)

    const uploadResult = await uploadFile(fullPath, buffer, file.type || undefined)
    if (!uploadResult.ok) {
      return NextResponse.json(
        { error: uploadResult.error ?? `Upload Nextcloud fallito (${uploadResult.status})` },
        { status: 502 },
      )
    }

    const documento = await insertDocumento({
      nome_file: file.name,
      url_storage: fullPath,
      dimensione_kb: Math.round(buffer.byteLength / 1024),
      record_id: recordId,
      record_tipo: recordTipo,
      caricato_da: utenteId,
    })

    return NextResponse.json({ documento }, { status: 201 })
  } catch (error) {
    console.error("[allegati] upload fallito:", error)
    return NextResponse.json({ error: "Errore nel caricamento" }, { status: 500 })
  }
}
