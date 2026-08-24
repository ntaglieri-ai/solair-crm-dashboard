// Export CSV dei Lead.
//
// Esiste come endpoint dedicato per due ragioni che il riuso di /api/leads non
// poteva coprire:
//
//   1. l'audit. `export_dati` era gia' ammesso dal CHECK constraint su
//      audit_log ma non lo scriveva nessuno: un export e' un'estrazione
//      massiva di dati personali e finora usciva dal CRM senza lasciare
//      traccia. La riga si scrive qui perche' logAudit vuole il service_role e
//      l'IP della richiesta, che il browser non ha.
//   2. il conteggio onesto. La lista tronca a pageSize 200 per protezione e il
//      client la usava come se fosse "tutto": oltre la 200esima riga il CSV
//      usciva incompleto senza dirlo. Qui il totale filtrato viene letto e
//      restituito sempre, anche quando supera il tetto di export.
import { NextResponse, after } from "next/server"
import { parseLeadsSearchParams } from "@/lib/leads/api-types"
import {
  queryLeadsByIdsForExport,
  queryLeadsForExport,
} from "@/lib/leads/repository"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import {
  criteriDaSearchParams,
  datiExport,
  descriviExport,
  logExportNegato,
  messaggioExportNegato,
} from "@/lib/audit/export"

const CHIAVI_FILTRO = [
  "search", "stato", "sede", "commerciale", "origine", "tag", "score",
  "onlyDuplicates", "advanced",
]

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
  if (!permissions.canRecord("lead", "export")) {
    after(() =>
      logExportNegato({
        entita: "Lead",
        modulo: "lead",
        ruoloCode: subject.ruoloCode,
        scope,
        criterio: criteriDaSearchParams(searchParams, CHIAVI_FILTRO),
        idsRichiesti: ids ? ids.length : null,
        attore: attoreDaPermessi(permissions),
        request,
      }),
    )
    return NextResponse.json(
      { error: messaggioExportNegato("Lead"), permessoMancante: "lead.export" },
      { status: 403 },
    )
  }

  try {

    const result = ids
      ? await queryLeadsByIdsForExport(ids)
      : await queryLeadsForExport(parseLeadsSearchParams(searchParams))

    // Dopo la risposta: l'audit non deve allungare l'attesa del download, e
    // soprattutto non deve poterla far fallire.
    after(() =>
      logAudit({
        tipo_evento: "export_dati",
        attore: attoreDaPermessi(permissions),
        modulo: "lead",
        descrizione: descriviExport("Lead", scope, result),
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
    const message = error instanceof Error ? error.message : "Errore export Lead"
    console.error("[api/leads/export]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
