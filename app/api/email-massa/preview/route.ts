import { NextResponse } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { MAX_BULK_RECIPIENTS } from "@/lib/email/bulk-template"
import {
  bulkTargetConfig,
  isBulkRecordTipo,
  resolveBulkRecipients,
} from "@/lib/email/bulk-targets"

// Anteprima "a secco" della selezione, chiamata all'apertura del dialog di
// composizione: dice quanti record verrebbero esclusi (proprieta' / email
// mancante) e restituisce i placeholder del PRIMO destinatario, usati per
// l'anteprima del messaggio.
//
// Riusa resolveBulkRecipients() esattamente come /api/email-massa: se
// l'anteprima e l'invio usassero logiche separate potrebbero divergere.

type Payload = {
  recordTipo?: unknown
  recordIds?: unknown
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Payload | null

  const recordTipo = payload?.recordTipo
  if (!isBulkRecordTipo(recordTipo)) {
    return NextResponse.json({ error: "Tipo record non valido." }, { status: 400 })
  }

  const config = bulkTargetConfig(recordTipo)
  const guard = await requireApiRecord(config.permissionModule, "view")
  if (guard.response) return guard.response

  const permissions = await getCurrentPermissions()
  if (!permissions.snapshot.subject.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  }

  const recordIds = Array.isArray(payload?.recordIds)
    ? payload.recordIds.filter((id): id is string => typeof id === "string")
    : []

  if (recordIds.length === 0) {
    return NextResponse.json({ error: "Nessun record selezionato." }, { status: 400 })
  }
  if (new Set(recordIds).size > MAX_BULK_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Massimo ${MAX_BULK_RECIPIENTS} destinatari per invio di massa. Riduci la selezione.`,
      },
      { status: 400 },
    )
  }

  const { data, error } = await resolveBulkRecipients({
    tipo: recordTipo,
    recordIds,
    snapshot: permissions.snapshot,
  })
  if (error || !data) {
    return NextResponse.json({ error: error ?? "Errore imprevisto" }, { status: 500 })
  }

  const primo = data.recipients[0] ?? null

  return NextResponse.json(
    {
      etichetta: config.label,
      totaleRichiesti: data.totaleRichiesti,
      destinatari: data.recipients.length,
      esclusiNonProprietari: data.esclusiNonProprietari,
      esclusiSenzaEmail: data.esclusiSenzaEmail,
      // Chi ha un indirizzo valido ma non il consenso: l'agente deve vederlo
      // qui, prima di scrivere il messaggio, non dopo aver premuto invia.
      esclusiSenzaConsenso: data.esclusiSenzaConsenso,
      // Serve al dialog di composizione per mostrare l'avviso quando il blocco
      // globale e' spento: l'agente deve sapere che sta per scrivere senza
      // filtro, non scoprirlo dall'audit.
      consensoEnforcementAttivo: data.consensoEnforcementAttivo,
      inviatiSenzaConsenso: data.consensoEnforcementAttivo
        ? 0
        : data.senzaConsenso.length,
      // Solo il primo: serve a rendere l'anteprima, non a esporre l'intera
      // rubrica selezionata al client.
      esempio: primo ? { email: primo.email, placeholders: primo.placeholders } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
