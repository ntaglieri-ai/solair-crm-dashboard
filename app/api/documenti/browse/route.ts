import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"
import { getNextcloudAppPassword, getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { listFolder } from "@/lib/nextcloud/webdav"
import { canAccessNcPath, normalizeNcPath } from "@/lib/nextcloud/path-permissions"

// Browser cartelle per il selettore "Aggiungi cartella preferita".
// Elenca le sole sottocartelle (Depth:1) del percorso richiesto, SEMPRE
// filtrate per ruolo: non si puo' navigare ne' listare un path che il ruolo
// dell'utente non puo' vedere (regole path-based enforced server-side).
export async function GET(request: Request) {
  const guard = await requireApiPage("documenti")
  if (guard.response) return guard.response

  const snapshot = await loadCurrentPermissionSnapshot()
  const { userId: utenteId, email, ruoloCode } = snapshot.subject
  if (!utenteId || !email) {
    return NextResponse.json({ error: "Utente non risolto" }, { status: 400 })
  }

  const path = normalizeNcPath(new URL(request.url).searchParams.get("path") ?? "")
  // Non permettere di navigare dentro un path non consentito al ruolo.
  if (path && !canAccessNcPath(path, ruoloCode)) {
    return NextResponse.json({ error: "Accesso al percorso non consentito" }, { status: 403 })
  }

  const appPassword = await getNextcloudAppPassword(utenteId)
  if (!appPassword) {
    return NextResponse.json({ error: "Account Nextcloud non provisionato" }, { status: 409 })
  }
  const username = (await getNextcloudUsername(utenteId)) ?? nextcloudUsernameFromEmail(email)

  try {
    const entries = await listFolder(username, appPassword, path)
    const folders = entries
      .filter((e) => e.isDir && canAccessNcPath(e.path, ruoloCode))
      .map((e) => ({ name: e.name, path: e.path, favorite: e.favorite }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ path, folders })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Errore lettura cartella" },
      { status: 502 },
    )
  }
}
