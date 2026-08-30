import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getNextcloudAppPassword } from "@/lib/nextcloud/credentials"
import { nextcloudBaseUrl } from "@/lib/nextcloud/config"
import {
  canAccessNcPath,
  loadNcPathRules,
  normalizeNcPath,
  roleRequiresExplicitNcPathRule,
} from "@/lib/nextcloud/path-permissions"
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
    const loginUrl = new URL("/nextcloud/login", request.url)
    loginUrl.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    return NextResponse.redirect(loginUrl)
  }

  const { data: utente } = await supabase
    .from("utenti")
    .select("id")
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

  const snapshot = await loadCurrentPermissionSnapshot()
  const pathRules = await loadNcPathRules()

  // Redirect target: root files, una cartella specifica, oppure un singolo file
  // (deep link /f/{fileid}, che Nextcloud risolve nel viewer del file). In tutti
  // i casi il path richiesto deve essere consentito al ruolo dell'utente: per un
  // file passiamo il suo path completo, cosi' le regole prefix-based lo coprono.
  // La destinazione operativa predefinita e' la cartella condivisa Solair,
  // non la root personale dell'account Nextcloud. AGENT fa eccezione: la radice
  // Solair non deve essere condivisa, quindi apre la root Nextcloud con le sole
  // cartelle puntuali condivise al suo gruppo.
  let redirectPath = roleRequiresExplicitNcPathRule(snapshot.subject.ruoloCode)
    ? "/apps/files/"
    : "/apps/files/?dir=/Solair"
  const requested = normalizeNcPath(request.nextUrl.searchParams.get("path") ?? "")
  const fileId = request.nextUrl.searchParams.get("fileid")
  if (requested) {
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
  // `solair-crm` e' il provider OIDC first-party registrato su questa istanza
  // (ID Nextcloud 3). L'env consente comunque di sostituirlo senza cambiare
  // codice se il provider viene ricreato con un ID diverso.
  const oidcLoginUrl =
    process.env.NEXTCLOUD_OIDC_LOGIN_URL ?? `${base}/apps/user_oidc/login/3`
  // La route diretta di user_oidc usa `redirectUrl` (camelCase). Con
  // `redirect_url` il login riesce, ma Nextcloud ignora la destinazione e apre
  // la root personale dell'utente.
  const loginUrl = `${oidcLoginUrl}${oidcLoginUrl.includes("?") ? "&" : "?"}redirectUrl=${encodeURIComponent(redirectPath)}`

  return NextResponse.redirect(loginUrl)
}
