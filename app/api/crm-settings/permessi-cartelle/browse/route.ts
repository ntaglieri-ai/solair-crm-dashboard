import { NextResponse } from "next/server"
import { requireApiAction } from "@/lib/permissions/server"
import { listFolder } from "@/lib/nextcloud/admin-webdav"
import { normalizeNcPath } from "@/lib/nextcloud/path-permissions"

export const dynamic = "force-dynamic"

const TEAM_FOLDER_ROOT = "Solair"

// Sfoglia l'albero REALE di Nextcloud (non un elenco di prefissi noti/digitati
// a mano) cosi' l'editor delle regole puo' mostrare ogni cartella esistente,
// comprese quelle di primo livello mai coperte da nessuna regola — il gap che
// ha causato l'accesso troppo ampio degli agenti (vedi nota in
// nextcloud-paths-editor.tsx). Un livello per chiamata (lazy), stessa
// convenzione del browser Documenti in app/api/documenti/browse.
export async function GET(request: Request) {
  const guard = await requireApiAction("crm_settings.account.roles.manage")
  if (guard.response) return guard.response

  const requestedPath = new URL(request.url).searchParams.get("path")?.trim() ?? TEAM_FOLDER_ROOT
  const path = normalizeNcPath(requestedPath || TEAM_FOLDER_ROOT).replace(/\/+$/, "")
  if (
    path.split("/").some((segment) => segment === "." || segment === "..") ||
    (path !== TEAM_FOLDER_ROOT && !path.startsWith(`${TEAM_FOLDER_ROOT}/`))
  ) {
    return NextResponse.json({ error: "Percorso non valido" }, { status: 400 })
  }

  const result = await listFolder(path)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Lettura cartella fallita" }, { status: 502 })
  }

  const cartelle = result.items
    .filter((item) => item.isFolder)
    .map((item) => ({ nome: item.nome, path: item.path }))

  return NextResponse.json(
    { path, cartelle, refreshedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  )
}
