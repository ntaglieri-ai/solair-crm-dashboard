// Loader server-side dei dati Documenti: preferiti (tabella) + recenti (WebDAV),
// SEMPRE filtrati per ruolo con le regole path-based prima di tornare al client.
import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { RoleCode } from "@/lib/permissions/types"
import type { CartellaPreferita, DocumentiData, DocumentoRecente } from "@/lib/documenti-data"
import { getNextcloudAppPassword, getNextcloudUsername } from "./credentials"
import { nextcloudUsernameFromEmail } from "./config"
import { listFavorites, recentFiles } from "./webdav"
import { canAccessNcPath, loadNcPathRules, normalizeNcPath } from "./path-permissions"

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
  // Credenziale, username e regole di path sono indipendenti fra loro: prima
  // erano tre await in fila, cioè tre roundtrip prima ancora di parlare con
  // Nextcloud. Se l'account non è provisionato paghiamo due letture inutili,
  // ma sono in parallelo e il caso è raro.
  const [appPassword, storedUsername, pathRules] = await Promise.all([
    getNextcloudAppPassword(user.utenteId),
    getNextcloudUsername(user.utenteId),
    loadNcPathRules(),
  ])

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
  const username = storedUsername ?? nextcloudUsernameFromEmail(user.email)
  const supabase = await createClient()

  // "recentFiles" non dipende dai preferiti: la avviamo subito, in
  // PARALLELO con la sincronizzazione preferiti qui sotto (che ha una sua
  // chiamata WebDAV separata, listFavorites) — prima erano in sequenza,
  // sommando due chiamate di rete verso Nextcloud invece di sovrapporle.
  // Trovato 25/07 mentre si cercava la causa della lentezza generale.
  const tRecentStart = Date.now()
  const recentFilesPromise = recentFiles(username, appPassword, 20)
    .catch((e) => {
      console.error(
        `[nextcloud] recentFiles fallito dopo ${Date.now() - tRecentStart}ms:`,
        e,
      )
      return null
    })

  // Preferiti (RLS: l'utente vede solo i propri) + filtro path-based per ruolo.
  const { data: favRows } = await supabase
    .from("cartelle_preferite")
    .select("id, label, path")
    .eq("utente_id", user.utenteId)
    .order("label")

  const favorites: CartellaPreferita[] = ((favRows ?? []) as CartellaPreferita[]).filter(
    (f) => canAccessNcPath(f.path, user.roleCode, pathRules),
  )

  // Sync bidirezionale con le stelle native Nextcloud (oc:favorite): importa le
  // cartelle marcate come preferite direttamente in Nextcloud che non sono
  // ancora nella tabella, cosi' persistono con una label. Best-effort: se il
  // REPORT fallisce mostriamo comunque i preferiti gia' salvati.
  const tFavStart = Date.now()
  try {
    const existingPaths = new Set(favorites.map((f) => normalizeNcPath(f.path)))
    const ncFavFolders = (await listFavorites(username, appPassword)).filter(
      (e) => e.isDir && canAccessNcPath(e.path, user.roleCode, pathRules),
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
    console.error(`[nextcloud] import favoriti nativi fallito dopo ${Date.now() - tFavStart}ms:`, e)
  }

  // Recenti: recupera il risultato della chiamata avviata in parallelo sopra.
  let recent: DocumentoRecente[] = []
  let message: string | null = null
  const files = await recentFilesPromise
  if (files === null) {
    message = "Impossibile leggere i file recenti da Nextcloud."
  } else {
    recent = files
      .filter((e) => canAccessNcPath(e.path, user.roleCode, pathRules))
      .slice(0, 8)
      .map((e) => ({
        name: e.name,
        path: e.path,
        size: e.size,
        modified: e.lastModified,
        fileId: e.fileId,
      }))
  }

  return { connected: true, message, favorites, recent }
}
