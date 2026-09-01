import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { downloadFile } from "@/lib/nextcloud/admin-webdav"
import { isPathInsideRecordFolder, type AllegatoRecordTipo } from "@/lib/allegati/paths"
import { canAccessCrmRecord } from "@/lib/permissions/data-scope"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: string | null): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

/**
 * Download di un file dalla cartella Nextcloud del record. Il file si identifica
 * con il suo `path` (query param), non con un id DB: il segmento [id] dell'URL
 * e' ignorato. Il path viene sempre validato contro la cartella del record —
 * la richiesta WebDAV parte con le credenziali admin, quindi un path arbitrario
 * darebbe accesso all'intera istanza.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  const recordTipo = searchParams.get("recordTipo")
  const recordId = searchParams.get("recordId")
  const nomeRecord = searchParams.get("nomeRecord")

  if (!path || !isValidTipo(recordTipo) || !recordId || !nomeRecord) {
    return NextResponse.json(
      { error: "path, recordTipo, recordId e nomeRecord richiesti" },
      { status: 400 },
    )
  }

  const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "view")
  if (guard.response) return guard.response
  if (!(await canAccessCrmRecord(guard.permissions.snapshot, recordTipo, recordId))) {
    return NextResponse.json({ error: "Non trovato" }, { status: 404 })
  }

  if (!isPathInsideRecordFolder(recordTipo, recordId, nomeRecord, path)) {
    return NextResponse.json({ error: "Percorso non consentito" }, { status: 403 })
  }

  const result = await downloadFile(path)
  if (!result.ok || !result.body) {
    return NextResponse.json(
      { error: result.error ?? `File non raggiungibile su Nextcloud (${result.status})` },
      { status: 502 },
    )
  }

  const nomeFile = path.split("/").pop() ?? "allegato"

  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(nomeFile)}"`,
      ...(result.contentLength ? { "Content-Length": result.contentLength } : {}),
    },
  })
}
