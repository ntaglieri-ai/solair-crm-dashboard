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
import { getCurrentPermissions } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import {
  criteriDaSearchParams,
  datiExport,
  descriviExport,
  logExportNegato,
  messaggioExportNegato,
} from "@/lib/audit/export"

const CHIAVI_FILTRO = ["search", "stato", "sede", "proprietario", "installatore"]

export async function GET(request: Request) {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const idsRaw = searchParams.get("ids")
  const ids = idsRaw ? idsRaw.split(",").filter(Boolean) : null
  const scope = ids ? "selezione" : "filtro"

  // Permesso di EXPORT, non di view: sono due cose diverse e il motore le
  // distingue gia' (RECORD_ACTIONS include "export" dal primo giorno, ma non
  // lo verificava nessuno — ne' qui ne' in UI). canRecord copre in un colpo
  // solo sia "non ha accesso al modulo" sia "ha il modulo ma non l'export",
  // e per entrambi la risposta giusta e' la stessa.
  if (!permissions.canRecord("clienti", "export")) {
    after(() =>
      logExportNegato({
        entita: "Clienti",
        modulo: "cliente",
        ruoloCode: subject.ruoloCode,
        scope,
        criterio: criteriDaSearchParams(searchParams, CHIAVI_FILTRO),
        idsRichiesti: ids ? ids.length : null,
        attore: attoreDaPermessi(permissions),
        request,
      }),
    )
    return NextResponse.json(
      { error: messaggioExportNegato("Clienti"), permessoMancante: "clienti.export" },
      { status: 403 },
    )
  }

  try {

    const result = ids
      ? await queryClientiByIdsForExport(ids)
      : await queryClientiForExport(parseClientiSearchParams(searchParams))

    after(() =>
      logAudit({
        tipo_evento: "export_dati",
        attore: attoreDaPermessi(permissions),
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
