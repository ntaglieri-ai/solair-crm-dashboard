import { NextRequest, NextResponse } from "next/server"

// ============================================================================
// LEGACY / DEPRECATO — avvio del flusso OAuth2 interattivo per-utente.
// Superato dal provisioning server-side (vedi callback/route.ts e
// lib/nextcloud/*). Non avvia piu' l'authorize OAuth: gli account Nextcloud
// vengono creati automaticamente alla creazione utente nel CRM.
// ============================================================================
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/documenti?nc_error=oauth_deprecated", request.url))
}
