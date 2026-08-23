import { NextResponse } from "next/server"
import { setCrmSessionCookies } from "@/lib/auth/session-policy"
import { createClient } from "@/lib/supabase/server"
import { leggiImpostazioniSicurezza } from "@/lib/session-access/security-settings"
import { clampTimeoutMinuti } from "@/lib/session-access/constants"

// Keepalive della sessione CRM. Lo chiama il login, il cambio password e — a
// intervalli — la guardia di inattivita' lato client.
//
// E' anche il punto in cui il timeout configurato in Session & Access raggiunge
// gli utenti gia' collegati: la lettura di crm_settings e' in cache di processo
// per 60 secondi (vedi security-settings), quindi non e' una query per ogni
// keepalive, e la guardia client aggiorna il proprio timer quando il valore
// tornato cambia. Un timeout modificato dalla pagina si propaga cosi' a tutti
// entro circa un minuto, senza logout ne' ricaricamenti.

export async function POST() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { impostazioni } = await leggiImpostazioniSicurezza()
  const timeoutSeconds = clampTimeoutMinuti(impostazioni.timeoutMinuti) * 60

  const response = NextResponse.json({ ok: true, timeoutSeconds })
  response.headers.set("Cache-Control", "no-store")
  setCrmSessionCookies(response, timeoutSeconds)
  return response
}
