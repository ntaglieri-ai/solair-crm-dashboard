import { NextResponse } from "next/server"
import { requireApiAction, requireApiPage } from "@/lib/permissions/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteFile, downloadAdminFile } from "@/lib/nextcloud/admin-webdav"
import { OFFERTA_COMMERCIALE_ROOT } from "@/lib/offerta-commerciale/store"

export const runtime = "nodejs"

/**
 * Documento del catalogo commerciale in sola lettura: serve alla card KPI
 * "Listino", che apre il PDF sincronizzato da Nextcloud.
 *
 * Passa dalle credenziali admin e non da quelle dell'utente: le cartelle sotto
 * Solair/ non sono condivise con gli account provisionati, quindi un agente
 * riceverebbe un 404 pur avendo il permesso di pagina. Il controllo di accesso
 * resta quindi tutto qui: permesso di pagina + path vincolato alla cartella del
 * catalogo (a differenza di /api/public/asset, che e' senza autenticazione e
 * non deve servire i listini).
 */
const MIME_DA_ESTENSIONE: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

export async function GET(request: Request) {
  const guard = await requireApiPage("offerta_commerciale")
  if (guard.response) return guard.response

  const path = new URL(request.url).searchParams.get("path")?.trim()
  if (!path) return NextResponse.json({ error: "Documento non valido" }, { status: 400 })
  if (path.includes("..") || !path.startsWith(`${OFFERTA_COMMERCIALE_ROOT}/`)) {
    return NextResponse.json({ error: "Documento fuori dal catalogo commerciale" }, { status: 400 })
  }

  let file: Response
  try {
    file = await downloadAdminFile(path)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "File non disponibile" }, { status: 502 })
  }

  const nome = path.split("/").pop() || "documento.pdf"
  // Nextcloud a volte risponde con "application/octet-stream" anche per PDF e
  // immagini: con quel Content-Type il browser forza il download anche se
  // Content-Disposition dice "inline". Deriviamo il tipo dall'estensione
  // (gli unici formati sincronizzati, vedi DOCUMENT_EXTENSIONS in sync.ts)
  // invece di fidarci dell'header grezzo di Nextcloud.
  const estensione = nome.split(".").pop()?.toLowerCase() ?? ""
  const contentType = MIME_DA_ESTENSIONE[estensione] ?? file.headers.get("content-type") ?? "application/pdf"
  return new Response(file.body, {
    headers: {
      "Content-Type": contentType,
      ...(file.headers.get("content-length") ? { "Content-Length": file.headers.get("content-length")! } : {}),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, max-age=300",
    },
  })
}

export async function DELETE(request: Request) {
  const guard = await requireApiAction("offerta_commerciale.manage")
  if (guard.response) return guard.response

  const path = new URL(request.url).searchParams.get("path")?.trim()
  if (!path) return NextResponse.json({ error: "Documento non valido" }, { status: 400 })
  if (path.includes("..") || !path.startsWith(`${OFFERTA_COMMERCIALE_ROOT}/`)) {
    return NextResponse.json({ error: "Documento fuori dal catalogo commerciale" }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ error: "Supabase admin non configurato" }, { status: 503 })

  const { data: cataloghi, error: cataloghiError } = await supabase
    .from("offerta_commerciale_cataloghi")
    .select("id, nome, stato")
    .eq("fonte_path", path)
  if (cataloghiError) return NextResponse.json({ error: cataloghiError.message }, { status: 500 })
  const bloccante = cataloghi?.find((catalogo) => catalogo.stato !== "archiviato")
  if (bloccante) {
    return NextResponse.json({
      error: `Il file è collegato al listino “${bloccante.nome}” (${bloccante.stato}). Sincronizza un nuovo listino o archivialo prima di cancellare il PDF.`,
    }, { status: 409 })
  }

  const deleted = await deleteFile(path)
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error ?? `Eliminazione Nextcloud fallita (${deleted.status})` }, { status: 502 })
  }

  const archivedCatalogIds = (cataloghi ?? []).map((catalogo) => catalogo.id)
  if (archivedCatalogIds.length > 0) {
    const { error: catalogDeleteError } = await supabase
      .from("offerta_commerciale_cataloghi")
      .delete()
      .in("id", archivedCatalogIds)
    if (catalogDeleteError) return NextResponse.json({ error: catalogDeleteError.message }, { status: 500 })
  }

  const { error: documentError } = await supabase.from("offerta_commerciale_documenti").delete().eq("path", path)
  if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })

  const { error: offerDeleteError } = await supabase
    .from("offerta_commerciale_offerte")
    .delete()
    .eq("pdf_path", path)
  if (offerDeleteError) return NextResponse.json({ error: offerDeleteError.message }, { status: 500 })

  const { error: coverUpdateError } = await supabase
    .from("offerta_commerciale_offerte")
    .update({ cover_path: null, aggiornato_at: new Date().toISOString() })
    .eq("cover_path", path)
  if (coverUpdateError) return NextResponse.json({ error: coverUpdateError.message }, { status: 500 })

  return NextResponse.json({ ok: true, cataloghi_eliminati: archivedCatalogIds.length })
}
