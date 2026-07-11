// Loader server-side dei dati Documenti: preferiti (tabella) + recenti (WebDAV),
// SEMPRE filtrati per ruolo con le regole path-based prima di tornare al client.
import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { RoleCode } from "@/lib/permissions/types"
import type { CartellaPreferita, DocumentiData, DocumentoRecente } from "@/lib/documenti-data"
import { getNextcloudAppPassword, getNextcloudUsername } from "./credentials"
import { nextcloudUsernameFromEmail } from "./config"
import { listFavorites, recentFiles } from "./webdav"
import { canAccessNcPath, normalizeNcPath } from "./path-permissions"

type CurrentUser = {
  utenteId: string
  email: string
  roleCode: RoleCode
}

/**
 * Carica i dati Documenti per l'utente corrente. Non lancia: se l'utente non e'
 * provisionato o Nextcloud e' irraggiungibile ritorna connected=false con un
 * messaggio, cosi' la pagina mostra una CTA invece di dati finti.
 */
export async function loadDocumentiData(user: CurrentUser): Promise<DocumentiData> {
  const appPassword = await getNextcloudAppPassword(user.utenteId)
  if (!appPassword) {
    return {
      connected: false,
      message:
        "Account Nextcloud non ancora provisionato. Contatta un amministratore per completare il collegamento.",
      favorites: [],
      recent: [],
    }
  }

  // Lo userid Nextcloud puo' NON coincidere con l'email (es. account admin
  // riconciliato a mano): usa quello memorizzato nella credenziale, con
  // fallback all'email per gli account provisionati in automatico.
  const username =
    (await getNextcloudUsername(user.utenteId)) ?? nextcloudUsernameFromEmail(user.email)
  const supabase = await createClient()

  // Preferiti (RLS: l'utente vede solo i propri) + filtro path-based per ruolo.
  const { data: favRows } = await supabase
    .from("cartelle_preferite")
    .select("id, label, path")
    .eq("utente_id", user.utenteId)
    .order("label")

  const favorites: CartellaPreferita[] = ((favRows ?? []) as CartellaPreferita[]).filter(
    (f) => canAccessNcPath(f.path, user.roleCode),
  )

  // Sync bidirezionale con le stelle native Nextcloud (oc:favorite): importa le
  // cartelle marcate come preferite direttamente in Nextcloud che non sono
  // ancora nella tabella, cosi' persistono con una label. Best-effort: se il
  // REPORT fallisce mostriamo comunque i preferiti gia' salvati.
  try {
    const existingPaths = new Set(favorites.map((f) => normalizeNcPath(f.path)))
    const ncFavFolders = (await listFavorites(username, appPassword)).filter(
      (e) => e.isDir && canAccessNcPath(e.path, user.roleCode),
    )
    const toImport = ncFavFolders.filter((e) => !existingPaths.has(normalizeNcPath(e.path)))

    if (toImport.length > 0) {
      const { data: imported } = await supabase
        .from("cartelle_preferite")
        .upsert(
          toImport.map((e) => ({ utente_id: user.utenteId, path: e.path, label: e.name })),
          { onConflict: "utente_id,path" },
        )
        .select("id, label, path")
      if (imported) favorites.push(...(imported as CartellaPreferita[]))
    }
    favorites.sort((a, b) => a.label.localeCompare(b.label))
  } catch (e) {
    console.error("[nextcloud] import favoriti nativi fallito:", e)
  }

  // Recenti via WebDAV, poi filtro path-based server-side.
  let recent: DocumentoRecente[] = []
  let message: string | null = null
  try {
    const files = await recentFiles(username, appPassword, 20)
    recent = files
      .filter((e) => canAccessNcPath(e.path, user.roleCode))
      .slice(0, 8)
      .map((e) => ({
        name: e.name,
        path: e.path,
        size: e.size,
        modified: e.lastModified,
        fileId: e.fileId,
      }))
  } catch (e) {
    message = "Impossibile leggere i file recenti da Nextcloud."
    console.error("[nextcloud] recentFiles fallito:", e)
  }

  return { connected: true, message, favorites, recent }
}
