import { loadIpBloccati, loadSessioniAttive } from "@/lib/session-access/queries"
import { leggiImpostazioniSicurezza } from "@/lib/session-access/security-settings"
import { requireSuperadmin } from "@/lib/permissions/server"
import { SessionAccessClient } from "./session-access-client"

// Sessioni e criteri di sicurezza sono amministrazione sensibile: accesso solo
// a SUPERADMIN, indipendente dai permessi generali di CRM Settings.
export const dynamic = "force-dynamic"

export default async function SessionAccessPage() {
  await requireSuperadmin()

  const [sessioni, ip, impostazioni] = await Promise.all([
    loadSessioniAttive(),
    loadIpBloccati(),
    leggiImpostazioniSicurezza(),
  ])

  return (
    <SessionAccessClient
      initialSessioni={sessioni.sessioni}
      initialIpBloccati={ip.ipBloccati}
      initialImpostazioni={impostazioni.impostazioni}
      // Un errore di lettura non deve presentarsi come "nessuna sessione": la
      // pagina lo dice esplicitamente invece di mostrare una tabella vuota.
      initialError={sessioni.errore ?? ip.errore ?? impostazioni.errore}
    />
  )
}
