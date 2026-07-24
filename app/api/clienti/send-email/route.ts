import { NextResponse } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { createClient } from "@/lib/supabase/server"
import { getPersonalEmailPassword, getPersonalEmailStatus } from "@/lib/email/personal-credentials"
import { sendLeadEmails } from "@/lib/email/lead-mailer"

// Mirror di app/api/leads/send-email/route.ts, ma per Clienti: stessa
// infrastruttura (casella Aruba personale dell'agente), tabella e azione di
// permesso diverse.

type SendEmailPayload = {
  clienteIds?: unknown
  subject?: unknown
  body?: unknown
}

export async function POST(request: Request) {
  const guard = await requireApiRecord("clienti", "view")
  if (guard.response) return guard.response

  const permissions = await getCurrentPermissions()
  const subject = permissions.snapshot.subject
  if (!subject.authUserId || !subject.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => null)) as SendEmailPayload | null
  const clienteIds = Array.isArray(payload?.clienteIds)
    ? payload.clienteIds.filter((id): id is string => typeof id === "string")
    : []
  const emailSubject = typeof payload?.subject === "string" ? payload.subject.trim() : ""
  const emailBody = typeof payload?.body === "string" ? payload.body : ""

  if (clienteIds.length === 0) {
    return NextResponse.json({ error: "Nessun cliente selezionato." }, { status: 400 })
  }
  if (!emailSubject) {
    return NextResponse.json({ error: "L'oggetto e' obbligatorio." }, { status: 400 })
  }

  const emailStatus = await getPersonalEmailStatus(subject.userId)
  if (!emailStatus.configured || !emailStatus.smtpUser) {
    return NextResponse.json(
      {
        error:
          "Configura prima la tua casella email personale nel tuo Profilo per poter scrivere ai clienti.",
        needsEmailSetup: true,
      },
      { status: 400 },
    )
  }

  const smtpPassword = await getPersonalEmailPassword(subject.userId)
  if (!smtpPassword) {
    return NextResponse.json(
      {
        error: "Impossibile leggere la password della tua casella. Riconfigurala dal Profilo.",
        needsEmailSetup: true,
      },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const { data: clienti, error: clientiError } = await supabase
    .from("clienti")
    .select("id, email")
    .in("id", clienteIds)

  if (clientiError) {
    return NextResponse.json({ error: clientiError.message }, { status: 500 })
  }

  const recipients = (clienti ?? [])
    .map((cliente) => (cliente as { email: string | null }).email)
    .filter((email): email is string => Boolean(email && email.includes("@")))

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Nessuno dei clienti selezionati ha un indirizzo email valido." },
      { status: 400 },
    )
  }

  const { results, truncated } = await sendLeadEmails({
    smtpUser: emailStatus.smtpUser,
    smtpPassword,
    recipients,
    subject: emailSubject,
    body: emailBody,
  })

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  return NextResponse.json({
    ok: true,
    sent,
    failed: failed.length,
    failedDetails: failed,
    truncated,
    totalRequested: clienteIds.length,
  })
}
