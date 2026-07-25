import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { deleteFile } from "@/lib/nextcloud/admin-webdav"
import {
  getDocumentoById,
  deleteDocumentoRow,
  deleteCollegamentoRow,
} from "@/lib/allegati/repository"
import type { AllegatoRecordTipo } from "@/lib/allegati/paths"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get("tipo") // "documento" | "collegamento"

  if (tipo === "documento") {
    const documento = await getDocumentoById(id)
    if (!documento) return NextResponse.json({ error: "Non trovato" }, { status: 404 })

    const guard = await requireApiRecord(PERMISSION_MODULE[documento.record_tipo], "delete")
    if (guard.response) return guard.response

    const removed = await deleteFile(documento.url_storage)
    if (!removed.ok) {
      console.error(
        `[allegati] impossibile eliminare il file Nextcloud ${documento.url_storage}:`,
        removed.error,
      )
    }
    await deleteDocumentoRow(id)
    return NextResponse.json({ ok: true })
  }

  if (tipo === "collegamento") {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("collegamenti")
      .select("record_tipo")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return NextResponse.json({ error: "Non trovato" }, { status: 404 })

    const recordTipo = data.record_tipo as AllegatoRecordTipo
    const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "delete")
    if (guard.response) return guard.response

    await deleteCollegamentoRow(id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "Parametro 'tipo' mancante o non valido" }, { status: 400 })
}
