// Export CSV dei Clienti. Gemello di app/api/leads/export/route.ts — stesse due
// ragioni per cui e' un endpoint a se': scrivere la riga di audit `export_dati`
// (che richiede service_role e l'IP della richiesta) e restituire il totale
// reale invece di lasciare che il client scambi una pagina per l'insieme.
import { NextResponse, after } from "next/server"
import { parseClientiSearchParams } from "@/lib/clienti/api-types"
import {
  queryClientiByIdsForExport,
  queryClientiForExport,
} from "@/lib/clienti/repository"
import { requireApiRecord } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { criteriDaSearchParams, datiExport, descriviExport } from "@/lib/audit/export"

const CHIAVI_FILTRO = ["search", "stato", "sede", "proprietario", "installatore"]

export async function GET(request: Request) {
  const guard = await requireApiRecord("clienti", "view")
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const idsRaw = searchParams.get("ids")
    const ids = idsRaw ? idsRaw.split(",").filter(Boolean) : null
    const scope = ids ? "selezione" : "filtro"

    const result = ids
      ? await queryClientiByIdsForExport(ids)
      : await queryClientiForExport(parseClientiSearchParams(searchParams))

    after(() =>
      logAudit({
        tipo_evento: "export_dati",
        attore: attoreDaPermessi(guard.permissions),
        modulo: "cliente",
        descrizione: descriviExport("Clienti", scope, result),
        dati_dopo: datiExport(
          scope,
          result,
          criteriDaSearchParams(searchParams, CHIAVI_FILTRO),
        ),
        request,
      }),
    )

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore export Clienti"
    console.error("[api/clienti/export]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
