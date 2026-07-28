import { NextResponse } from "next/server"
import { getCurrentPermissions } from "@/lib/permissions/server"
import { getEmailMassaJob, isEmailMassaJobStallo } from "@/lib/email/bulk-job-store"

// Polling dell'avanzamento di un invio di massa (la UI chiama ogni ~2.5s).
// La lettura passa dal service_role, quindi il controllo di proprieta' e'
// esplicito qui: un job e' visibile solo a chi l'ha creato.

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  }

  const { jobId } = await context.params
  const job = await getEmailMassaJob(jobId)
  if (!job) {
    return NextResponse.json({ error: "Invio non trovato." }, { status: 404 })
  }
  if (job.creatoDa !== subject.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Lo stallo e' calcolato in lettura e non persistito: se il background task
  // e' solo lento a scrivere il prossimo flush, il poll successivo torna a
  // mostrarlo correttamente come "in corso".
  const stallo = isEmailMassaJobStallo(job)

  return NextResponse.json(
    {
      jobId: job.id,
      recordTipo: job.recordTipo,
      oggetto: job.oggetto,
      totale: job.totale,
      inviate: job.inviate,
      fallite: job.fallite,
      stato: stallo ? "errore" : job.stato,
      errore: stallo
        ? `Invio interrotto dopo ${job.inviate} email su ${job.totale}. Riprova sui destinatari rimanenti.`
        : job.errore,
      createdAt: job.createdAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
