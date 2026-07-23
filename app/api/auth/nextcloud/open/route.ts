import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getNextcloudAppPassword, getNextcloudUsername } from "@/lib/nextcloud/credentials"
import { nextcloudBaseUrl, nextcloudUsernameFromEmail } from "@/lib/nextcloud/config"
import { canAccessNcPath, loadNcPathRules, normalizeNcPath } from "@/lib/nextcloud/path-permissions"
import { loadCurrentPermissionSnapshot } from "@/lib/permissions/load-permissions"

// "Apri Nextcloud": verifica che l'account tecnico sia provisionato e apre il
// login web con lo username precompilato. La password principale e' la stessa
// del CRM; l'app-password cifrata resta riservata alle chiamate WebDAV/API.
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

  const username =
    (await getNextcloudUsername(utente.id)) ?? nextcloudUsernameFromEmail(utente.email)

  // Redirect target: root files, una cartella specifica, oppure un singolo file
  // (deep link /f/{fileid}, che Nextcloud risolve nel viewer del file). In tutti
  // i casi il path richiesto deve essere consentito al ruolo dell'utente: per un
  // file passiamo il suo path completo, cosi' le regole prefix-based lo coprono.
  let redirectPath = "/apps/files"
  const requested = normalizeNcPath(request.nextUrl.searchParams.get("path") ?? "")
  const fileId = request.nextUrl.searchParams.get("fileid")
  if (requested) {
    const snapshot = await loadCurrentPermissionSnapshot()
    const pathRules = await loadNcPathRules()
    if (canAccessNcPath(requested, snapshot.subject.ruoloCode, pathRules)) {
      // fileid e' sempre numerico su Nextcloud: valida per evitare open-redirect.
      redirectPath =
        fileId && /^\d+$/.test(fileId)
          ? `/f/${fileId}`
          : `/apps/files/?dir=/${requested}`
    }
  }

  // Quando user_oidc e' configurato, il login Nextcloud inoltra la sessione
  // CRM gia' attiva a Supabase OIDC e torna senza chiedere la password. Il
  // fallback mantiene il login condiviso tradizionale finche' la configurazione
  // server non e' stata completata.
  const oidcLoginUrl = process.env.NEXTCLOUD_OIDC_LOGIN_URL
  const loginUrl = oidcLoginUrl
    ? `${oidcLoginUrl}${oidcLoginUrl.includes("?") ? "&" : "?"}redirect_url=${encodeURIComponent(redirectPath)}`
    : `${base}/login?user=${encodeURIComponent(username)}&redirect_url=${encodeURIComponent(redirectPath)}`

  return NextResponse.redirect(loginUrl)
}
