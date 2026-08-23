import { AUDIT_PAGE_SIZE } from "@/lib/audit/constants"
import { loadAuditEvents, loadAuditStats, loadAuditUtenti } from "@/lib/audit/queries"
import { AuditLogClient } from "./audit-log-client"

// Il gate di permesso vive nel layout della sezione (crm_settings.account.audit)
// e la rotta API applica lo stesso controllo: qui si carica soltanto.
export const dynamic = "force-dynamic"

const PERIODO_INIZIALE = "7g" as const

export default async function AuditLogPage() {
  const [{ stats, error: statsError }, eventi, utenti] = await Promise.all([
    loadAuditStats(),
    loadAuditEvents({
      periodo: PERIODO_INIZIALE,
      tipo: "all",
      utenteId: "all",
      search: "",
      page: 1,
    }),
    loadAuditUtenti(),
  ])

  return (
    <AuditLogClient
      initialStats={stats}
      initialEvents={eventi.rows}
      initialTotal={eventi.total}
      initialTotalPages={eventi.totalPages}
      utenti={utenti}
      pageSize={AUDIT_PAGE_SIZE}
      // Un errore di lettura non deve presentarsi come "nessun evento": la
      // pagina lo dice esplicitamente invece di mostrare una tabella vuota.
      initialError={eventi.error ?? statsError}
    />
  )
}
