import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getNextcloudAppPassword } from "@/lib/nextcloud/credentials"
import { nextcloudBaseUrl, nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { canAccessNcPath, normalizeNcPath } from "@/lib/nextcloud/path-permissions"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"

// "Apri Nextcloud": autentica l'utente su Nextcloud tramite la sua app-password
// gia' provisionata (nessun OAuth interattivo). Ricicla la tecnica del
// session-bridge /login?user=&password= usando la app-password cifrata a DB.
// Con ?path=... apre direttamente quella cartella, ma solo se il ruolo vi ha
// accesso (regole path-based enforced anche qui, non solo in UI).
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const base = nextcloudBaseUrl()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: utente } = await supabase
    .from("utenti")
    .select("id, email")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (!utente) {
    return NextResponse.redirect(new URL("/documenti?nc_error=no_account", request.url))
  }

  const appPassword = await getNextcloudAppPassword(utente.id)
  if (!appPassword) {
    // Provisioning non completato: rimanda alla pagina con errore esplicito.
    return NextResponse.redirect(new URL("/documenti?nc_error=not_provisioned", request.url))
  }

  const username = nextcloudUsernameFromEmail(utente.email)

  // Redirect target: root files, una cartella specifica, oppure un singolo file
  // (deep link /f/{fileid}, che Nextcloud risolve nel viewer del file). In tutti
  // i casi il path richiesto deve essere consentito al ruolo dell'utente: per un
  // file passiamo il suo path completo, cosi' le regole prefix-based lo coprono.
  let redirectPath = "/apps/files"
  const requested = normalizeNcPath(request.nextUrl.searchParams.get("path") ?? "")
  const fileId = request.nextUrl.searchParams.get("fileid")
  if (requested) {
    const snapshot = await loadCurrentPermissionSnapshot()
    if (canAccessNcPath(requested, snapshot.subject.ruoloCode)) {
      // fileid e' sempre numerico su Nextcloud: valida per evitare open-redirect.
      redirectPath =
        fileId && /^\d+$/.test(fileId)
          ? `/f/${fileId}`
          : `/apps/files/?dir=/${requested}`
    }
  }

  const loginUrl = `${base}/login?user=${encodeURIComponent(username)}&password=${encodeURIComponent(appPassword)}&redirect_url=${encodeURIComponent(redirectPath)}`

  return NextResponse.redirect(loginUrl)
}
