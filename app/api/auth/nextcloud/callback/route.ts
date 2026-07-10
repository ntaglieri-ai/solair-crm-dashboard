import { NextRequest, NextResponse } from "next/server"

// ============================================================================
// LEGACY / DEPRECATO — flusso OAuth2 interattivo per-utente.
// ----------------------------------------------------------------------------
// Superato dal provisioning server-side (Provisioning API + app-password
// cifrata, vedi lib/nextcloud/*). La vecchia implementazione scriveva i token
// su utenti.nextcloud_access_token / _refresh_token / _token_expires_at, colonne
// che NON esistono in nessuna migrazione: la scrittura falliva in silenzio.
// Quella scrittura e' stata RIMOSSA. La route resta solo per non rompere
// eventuali redirect_uri registrati su Nextcloud e non esegue piu' alcuna
// persistenza. Non riattivare senza prima creare colonne reali per i token.
// ============================================================================
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/documenti?nc_error=oauth_deprecated", request.url))
}
