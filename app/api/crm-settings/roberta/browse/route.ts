import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { listFolder } from "@/lib/nextcloud/admin-webdav"

async function requireRobertaCatalogAccess() {
  const permissions = await getCurrentPermissions()
  if (
    !permissions.canPage("crm_settings.system.roberta") &&
    !permissions.canAction("offerta_commerciale.manage")
  ) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { response: null }
}

export async function GET(request: Request) {
  const guard = await requireRobertaCatalogAccess()
  if (guard.response) return guard.response

  const path = new URL(request.url).searchParams.get("path")?.trim() || "Solair"
  const normalizedPath = path.replace(/^\/+|\/+$/g, "")
  if (!normalizedPath.startsWith("Solair")) {
    return NextResponse.json({ error: "Percorso non consentito" }, { status: 403 })
  }

  const listing = await listFolder(normalizedPath)
  if (!listing.ok) {
    return NextResponse.json(
      { error: listing.error ?? `Lettura cartella fallita (${listing.status})` },
      { status: 502 },
    )
  }

  return NextResponse.json({
    path: normalizedPath,
    folders: listing.items
      .filter((item) => item.isFolder)
      .map((item) => ({ name: item.nome, path: item.path })),
    pdfCount: listing.items.filter((item) => !item.isFolder && item.nome.toLowerCase().endsWith(".pdf")).length,
  })
}
