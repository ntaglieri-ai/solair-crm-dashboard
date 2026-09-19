// Export degli Installatori. Terzo gemello di app/api/clienti/export/route.ts
// e app/api/leads/export/route.ts, con le stesse due ragioni per cui e' un
// endpoint a se': scrivere la riga di audit `export_dati` (che richiede
// service_role e l'IP della richiesta) e restituire il totale reale invece di
// lasciare che il client scambi una pagina per l'insieme.
//
// Fino al 16/09/2026 gli Installatori non avevano alcun export: l'unico modo
// di portarsi via l'elenco era copiarlo a mano dallo schermo, cosa che non
// lascia traccia da nessuna parte. Il permesso `installatori.export` esisteva
// gia' nel motore dei permessi — non lo verificava nessuno perche' non c'era
// niente da verificare.
import { NextResponse, after } from "next/server"
import { parseInstallatoriSearchParams } from "@/lib/installatori/api-types"
import {
  queryInstallatoriByIdsForExport,
  queryInstallatoriForExport,
} from "@/lib/installatori/repository"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import {
  criteriDaSearchParams,
  datiExport,
  descriviExport,
  logExportNegato,
  messaggioExportNegato,
} from "@/lib/audit/export"

const CHIAVI_FILTRO = ["search", "stato", "tag", "proprietario"]

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
  // distingue gia'. canRecord copre in un colpo solo sia "non ha accesso al
  // modulo" sia "ha il modulo ma non l'export".
  if (!permissions.canRecord("installatori", "export")) {
    after(() =>
      logExportNegato({
        entita: "Installatori",
        modulo: "installatore",
        ruoloCode: subject.ruoloCode,
        scope,
        criterio: criteriDaSearchParams(searchParams, CHIAVI_FILTRO),
        idsRichiesti: ids ? ids.length : null,
        attore: attoreDaPermessi(permissions),
        request,
      }),
    )
    return NextResponse.json(
      {
        error: messaggioExportNegato("Installatori"),
        permessoMancante: "installatori.export",
      },
      { status: 403 },
    )
  }

  try {
    const result = ids
      ? await queryInstallatoriByIdsForExport(ids)
      : await queryInstallatoriForExport(parseInstallatoriSearchParams(searchParams))

    after(() =>
      logAudit({
        tipo_evento: "export_dati",
        attore: attoreDaPermessi(permissions),
        modulo: "installatore",
        descrizione: descriviExport("Installatori", scope, result),
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
    const message = error instanceof Error ? error.message : "Errore export Installatori"
    console.error("[api/installatori/export]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
