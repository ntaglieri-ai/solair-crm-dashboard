import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { downloadFile } from "@/lib/nextcloud/admin-webdav"
import { getDocumentoById } from "@/lib/allegati/repository"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const documento = await getDocumentoById(id)
  if (!documento) return NextResponse.json({ error: "Non trovato" }, { status: 404 })

  const guard = await requireApiRecord(PERMISSION_MODULE[documento.record_tipo], "view")
  if (guard.response) return guard.response

  const result = await downloadFile(documento.url_storage)
  if (!result.ok || !result.body) {
    return NextResponse.json(
      { error: result.error ?? `File non raggiungibile su Nextcloud (${result.status})` },
      { status: 502 },
    )
  }

  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(documento.nome_file)}"`,
      ...(result.contentLength ? { "Content-Length": result.contentLength } : {}),
    },
  })
}
