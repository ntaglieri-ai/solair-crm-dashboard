import { AUDIT_PAGE_SIZE } from "@/lib/audit/constants"
import { loadAuditEvents, loadAuditStats, loadAuditUtenti } from "@/lib/audit/queries"
import { requireSuperadmin } from "@/lib/permissions/server"
import { AuditLogClient } from "./audit-log-client"

// Registro sensibile: accessibile solo a SUPERADMIN, senza ereditarieta' dai
// permessi generali di CRM Settings.
export const dynamic = "force-dynamic"

const PERIODO_INIZIALE = "7g" as const

export default async function AuditLogPage() {
  await requireSuperadmin()

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
