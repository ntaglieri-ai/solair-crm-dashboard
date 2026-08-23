import { NextResponse } from "next/server"
import { requireApiPage } from "@/lib/permissions/server"
import { loadIpBloccati, loadSessioniAttive } from "@/lib/session-access/queries"
import { leggiImpostazioniSicurezza } from "@/lib/session-access/security-settings"

// Ricarica i dati della pagina Session & Access dopo un'azione (revoca,
// blocco, sblocco). Il primo caricamento arriva gia' renderizzato dal server
// component: questa rotta risponde solo alle interazioni successive.
//
// Stesso permesso della pagina: senza `crm_settings.account.session` le
// sessioni altrui non sono leggibili nemmeno chiamando l'endpoint a mano.

export async function GET() {
  const guard = await requireApiPage("crm_settings.account.session")
  if (guard.response) return guard.response

  const [sessioni, ip, impostazioni] = await Promise.all([
    loadSessioniAttive(),
    loadIpBloccati(),
    leggiImpostazioniSicurezza(),
  ])

  const response = NextResponse.json({
    sessioni: sessioni.sessioni,
    ipBloccati: ip.ipBloccati,
    impostazioni: impostazioni.impostazioni,
    errore: sessioni.errore ?? ip.errore ?? impostazioni.errore,
  })
  response.headers.set("Cache-Control", "no-store")
  return response
}
