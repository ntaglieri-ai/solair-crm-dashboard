import { loadIpBloccati, loadSessioniAttive } from "@/lib/session-access/queries"
import { leggiImpostazioniSicurezza } from "@/lib/session-access/security-settings"
import { SessionAccessClient } from "./session-access-client"

// Il gate di permesso vive nel layout della sezione (crm_settings.account.session)
// e ogni rotta API applica lo stesso controllo: qui si carica soltanto.
export const dynamic = "force-dynamic"

export default async function SessionAccessPage() {
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
