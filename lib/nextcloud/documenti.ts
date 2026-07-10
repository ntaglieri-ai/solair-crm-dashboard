// Loader server-side dei dati Documenti: preferiti (tabella) + recenti (WebDAV),
// SEMPRE filtrati per ruolo con le regole path-based prima di tornare al client.
import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { RoleCode } from "@/lib/permissions/types"
import type { CartellaPreferita, DocumentiData, DocumentoRecente } from "@/lib/documenti-data"
import { getNextcloudAppPassword } from "./credentials"
import { nextcloudUsernameFromEmail } from "./config"
import { recentFiles } from "./webdav"
import { canAccessNcPath } from "./path-permissions"

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

  const username = nextcloudUsernameFromEmail(user.email)
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
      }))
  } catch (e) {
    message = "Impossibile leggere i file recenti da Nextcloud."
    console.error("[nextcloud] recentFiles fallito:", e)
  }

  return { connected: true, message, favorites, recent }
}
