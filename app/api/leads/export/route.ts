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
import { requireApiRecord } from "@/lib/permissions/server"
import { attoreDaPermessi, logAudit } from "@/lib/audit/log"
import { criteriDaSearchParams, datiExport, descriviExport } from "@/lib/audit/export"

const CHIAVI_FILTRO = [
  "search", "stato", "sede", "commerciale", "origine", "tag", "score",
  "onlyDuplicates", "advanced",
]

export async function GET(request: Request) {
  const guard = await requireApiRecord("lead", "view")
  if (guard.response) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const idsRaw = searchParams.get("ids")
    const ids = idsRaw ? idsRaw.split(",").filter(Boolean) : null
    const scope = ids ? "selezione" : "filtro"

    const result = ids
      ? await queryLeadsByIdsForExport(ids)
      : await queryLeadsForExport(parseLeadsSearchParams(searchParams))

    // Dopo la risposta: l'audit non deve allungare l'attesa del download, e
    // soprattutto non deve poterla far fallire.
    after(() =>
      logAudit({
        tipo_evento: "export_dati",
        attore: attoreDaPermessi(guard.permissions),
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
