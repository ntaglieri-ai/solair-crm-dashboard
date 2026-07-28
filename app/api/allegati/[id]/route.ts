import { NextResponse } from "next/server"
import { requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { deleteFile } from "@/lib/nextcloud/admin-webdav"
import { deleteCollegamentoRow } from "@/lib/allegati/repository"
import { isPathInsideRecordFolder, type AllegatoRecordTipo } from "@/lib/allegati/paths"

const PERMISSION_MODULE: Record<AllegatoRecordTipo, string> = {
  lead: "lead",
  cliente: "clienti",
  installatore: "installatori",
}

function isValidTipo(value: string | null): value is AllegatoRecordTipo {
  return value === "lead" || value === "cliente" || value === "installatore"
}

/**
 * tipo=documento -> il file vive solo su Nextcloud, quindi si identifica con il
 * suo `path` (query param), non piu' con un id DB: il segmento [id] dell'URL e'
 * ignorato in questo caso. recordTipo/recordId/nomeRecord servono a verificare
 * i permessi E che il path appartenga davvero alla cartella di quel record —
 * senza quel controllo un path arbitrario girerebbe con le credenziali admin.
 * tipo=collegamento resta invariato (DB-backed, per id).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get("tipo") // "documento" | "collegamento"

  if (tipo === "documento") {
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

    const guard = await requireApiRecord(PERMISSION_MODULE[recordTipo], "delete")
    if (guard.response) return guard.response

    if (!isPathInsideRecordFolder(recordTipo, recordId, nomeRecord, path)) {
      return NextResponse.json({ error: "Percorso non consentito" }, { status: 403 })
    }

    const removed = await deleteFile(path)
    if (!removed.ok) {
      console.error(`[allegati] impossibile eliminare il file Nextcloud ${path}:`, removed.error)
      return NextResponse.json(
        { error: removed.error ?? `Eliminazione su Nextcloud fallita (${removed.status})` },
        { status: 502 },
      )
    }
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
