import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { ensureFolder, listFolder, uploadFile } from "@/lib/nextcloud/admin-webdav"
import {
  filePathForRecord,
  folderPathForRecord,
  sanitizeName,
  type AllegatoRecordTipo,
} from "@/lib/allegati/paths"
import { listCollegamenti } from "@/lib/allegati/repository"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: string | null): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

/**
 * Sezione "Documenti" degli allegati record: la fonte di verita' e' SOLO la
 * cartella Nextcloud del record (decisione confermata 27/07 con Nando). La
 * tabella `documenti` non viene piu' letta ne' scritta da questo flusso — resta
 * nel DB, ma non e' piu' una fonte. I `collegamenti` (link esterni) restano
 * invece DB-backed: sono un tipo di elemento diverso, non file su Nextcloud.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recordTipo = searchParams.get("recordTipo")
  const recordId = searchParams.get("recordId")
  const nomeRecord = searchParams.get("nomeRecord")

  if (!isValidTipo(recordTipo) || !recordId || !nomeRecord) {
    return NextResponse.json(
      { error: "recordTipo, recordId e nomeRecord richiesti" },
      { status: 400 },
    )
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "view")
  if (guard.response) return guard.response

  try {
    const folderPath = folderPathForRecord(recordTipo, recordId, nomeRecord)
    const [listing, collegamenti] = await Promise.all([
      listFolder(folderPath),
      listCollegamenti(recordTipo, recordId),
    ])

    if (!listing.ok) {
      return NextResponse.json(
        { error: listing.error ?? `Lettura cartella Nextcloud fallita (${listing.status})` },
        { status: 502 },
      )
    }

    // folderPath torna al client cosi' non deve ricalcolarlo: e' anche il path
    // passato a /api/auth/nextcloud/open per il pulsante "Apri in Nextcloud".
    return NextResponse.json({ folderPath, documenti: listing.items, collegamenti })
  } catch (error) {
    console.error("[allegati] GET fallita:", error)
    return NextResponse.json({ error: "Errore nel recupero allegati" }, { status: 500 })
  }
}

/** Creazione sottocartella dentro la cartella del record (body JSON). */
async function creaSottocartella(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    recordTipo?: string
    recordId?: string
    nomeRecord?: string
    nuovaCartella?: string
  } | null

  const recordTipo = body?.recordTipo ?? null
  if (!isValidTipo(recordTipo) || !body?.recordId || !body?.nomeRecord || !body?.nuovaCartella) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 })
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "edit")
  if (guard.response) return guard.response

  // Stessa sanitizzazione dei nomi record/file (paths.ts); i soli punti sono
  // rifiutati a parte perche' sanitizeName non li tocca e "." / ".." darebbero
  // traversal sul path DAV.
  const nome = sanitizeName(body.nuovaCartella)
  if (!nome || /^\.+$/.test(nome)) {
    return NextResponse.json({ error: "Nome cartella non valido" }, { status: 400 })
  }

  const fullPath = `${folderPathForRecord(recordTipo, body.recordId, body.nomeRecord)}/${nome}`
  // ensureFolder e' gia' idempotente (405 = esiste gia' = non e' un errore).
  const result = await ensureFolder(fullPath)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? `Creazione cartella fallita (${result.status})` },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, path: fullPath }, { status: 201 })
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return creaSottocartella(request)
  }

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fullPath = filePathForRecord(recordTipo, recordId, nomeRecord, file.name)

    // Nessuna riga su `documenti`: il file compare perche' la GET rilegge
    // sempre il contenuto reale della cartella Nextcloud.
    const uploadResult = await uploadFile(fullPath, buffer, file.type || undefined)
    if (!uploadResult.ok) {
      return NextResponse.json(
        { error: uploadResult.error ?? `Upload Nextcloud fallito (${uploadResult.status})` },
        { status: 502 },
      )
    }

    return NextResponse.json({ path: fullPath }, { status: 201 })
  } catch (error) {
    console.error("[allegati] upload fallito:", error)
    return NextResponse.json({ error: "Errore nel caricamento" }, { status: 500 })
  }
}
