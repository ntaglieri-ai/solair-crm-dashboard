import { NextResponse } from "next/server"
import { requireApiSuperadmin } from "@/lib/permissions/server"
import {
  isAuditEventType,
  isAuditPeriodo,
  type AuditFiltri,
} from "@/lib/audit/constants"
import { loadAuditEvents } from "@/lib/audit/queries"

// Serve i cambi di filtro e di pagina della tabella Audit & Log. Il primo
// caricamento arriva gia' renderizzato dal server component: questa rotta
// risponde solo alle interazioni successive.
//
// Registro sensibile: solo SUPERADMIN, anche se un ruolo eredita CRM Settings.

export async function GET(request: Request) {
  const guard = await requireApiSuperadmin()
  if (guard.response) return guard.response

  const params = new URL(request.url).searchParams
  const periodo = params.get("periodo")
  const tipo = params.get("tipo")
  const utenteId = params.get("utente")
  const pageRaw = Number(params.get("page"))

  const filtri: AuditFiltri = {
    periodo: isAuditPeriodo(periodo) ? periodo : "7g",
    tipo: isAuditEventType(tipo) ? tipo : "all",
    utenteId: utenteId && utenteId !== "all" ? utenteId : "all",
    search: params.get("search") ?? "",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  }

  const result = await loadAuditEvents(filtri)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const response = NextResponse.json(result)
  response.headers.set("Cache-Control", "no-store")
  return response
}
