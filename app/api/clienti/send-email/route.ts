import { NextResponse, after } from "next/server"
import { getCurrentPermissions, requireApiRecord } from "@/lib/permissions/server"
import { getPersonalEmailPassword, getPersonalEmailStatus } from "@/lib/email/personal-credentials"
import { hasSystemOutboundSmtp, sendLeadEmails } from "@/lib/email/lead-mailer"
import { resolveSender } from "@/lib/email/sender-accounts"
import { logEmailInviate } from "@/lib/email/email-log"
import {
  filtraDestinatariConsenzienti,
  messaggioNessunConsenziente,
  quantiBloccati,
} from "@/lib/email/consent"

// Mirror di app/api/leads/send-email/route.ts, ma per Clienti: stesso mailer
// operativo (SES di sistema con Reply-To agente, fallback Aruba personale),
// tabella e azione di permesso diverse.

type SendEmailPayload = {
  clienteIds?: unknown
  subject?: unknown
  body?: unknown
  /** Id della casella crm_email_accounts scelta nel dropdown "Invia da". */
  mittenteId?: unknown
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
  const mittenteId = typeof payload?.mittenteId === "string" ? payload.mittenteId : null

  if (clienteIds.length === 0) {
    return NextResponse.json({ error: "Nessun cliente selezionato." }, { status: 400 })
  }
  if (!emailSubject) {
    return NextResponse.json({ error: "L'oggetto e' obbligatorio." }, { status: 400 })
  }

  // Il nome storico della funzione resta, ma oggi risolve solo i destinatari
  // con indirizzo email valido: il consenso non blocca invii e non genera avvisi.
  const { data: consenso, error: consensoError } = await filtraDestinatariConsenzienti({
    entita: "cliente",
    ids: clienteIds,
  })
  if (consensoError || !consenso) {
    return NextResponse.json({ error: consensoError ?? "Errore imprevisto" }, { status: 500 })
  }

  const bloccatiSenzaConsenso = quantiBloccati(consenso)

  if (consenso.destinatari.length === 0) {
    return NextResponse.json(
      {
        error: messaggioNessunConsenziente({
          entita: "cliente",
          bloccatiSenzaConsenso,
        }),
        bloccatiSenzaConsenso,
        esclusiSenzaEmail: consenso.esclusiSenzaEmail,
      },
      { status: 400 },
    )
  }

  // La casella personale del Profilo serve SOLO al fallback Aruba, che si
  // autentica davvero su di essa. Con l'SMTP di sistema disponibile (SES) le
  // credenziali di invio sono quelle di sistema e la casella personale entra
  // al piu' come Reply-To, per cui basta l'indirizzo dell'utente.
  //
  // Prima questo controllo era incondizionato e bloccava chiunque non avesse
  // una riga in email_credentials_personali — cioe' tutti, visto che quella
  // tabella e' vuota. Il mittente vero arriva da crm_email_accounts.
  const systemSmtpAvailable = hasSystemOutboundSmtp()
  const emailStatus = await getPersonalEmailStatus(subject.userId)
  const smtpPassword = emailStatus.configured
    ? ((await getPersonalEmailPassword(subject.userId)) ?? undefined)
    : undefined

  if (!systemSmtpAvailable && (!emailStatus.smtpUser || !smtpPassword)) {
    return NextResponse.json(
      {
        error:
          "Configura prima la tua casella email personale nel tuo Profilo per poter scrivere ai clienti.",
        needsEmailSetup: true,
      },
      { status: 400 },
    )
  }

  // Mittente rivalidato QUI e non solo nel dropdown: la route e' raggiungibile
  // direttamente, e chi non ha ruoli.puo_scegliere_mittente non deve poter
  // spedire a nome di una casella condivisa passando l'id a mano.
  const mittente = await resolveSender({ utenteId: subject.userId, accountId: mittenteId })
  if (!mittente.ok) {
    return NextResponse.json({ error: mittente.error }, { status: 403 })
  }

  const { results, truncated, fromEmail, fromName } = await sendLeadEmails({
    smtpUser: emailStatus.smtpUser ?? subject.email ?? undefined,
    smtpPassword,
    fromEmail: mittente.sender.fromEmail,
    fromName: mittente.sender.fromName,
    recipients: consenso.destinatari.map((destinatario) => destinatario.email),
    subject: emailSubject,
    body: emailBody,
  })

  const sent = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)

  // Storico: solo gli invii andati a buon fine, uno per destinatario. Si
  // rimappano gli esiti sugli id dei destinatari, che sendLeadEmails non
  // conosce (riceve solo indirizzi). Va in after(): una riga di storico non
  // deve allungare la risposta di un invio gia' partito.
  const inviatiOk = new Set(results.filter((r) => r.ok).map((r) => r.to))
  const daRegistrare = consenso.destinatari.filter((d) => inviatiOk.has(d.email))
  if (daRegistrare.length > 0) {
    after(() =>
      logEmailInviate({
        entita: "cliente",
        destinatari: daRegistrare,
        // Il mittente REALE come risolto dal transport: la casella scelta,
        // oppure quella di sistema se l'utente non ne ha una propria. Non
        // ri-derivato qui, altrimenti lo storico e l'header From potrebbero
        // divergere.
        fromEmail,
        fromNome: fromName,
        oggetto: emailSubject,
        inviataDa: subject.userId,
      }),
    )
  }

  return NextResponse.json({
    ok: true,
    sent,
    failed: failed.length,
    failedDetails: failed,
    truncated,
    totalRequested: clienteIds.length,
    bloccatiSenzaConsenso,
    esclusiSenzaEmail: consenso.esclusiSenzaEmail,
    consensoEnforcementAttivo: consenso.enforcementAttivo,
    inviatiSenzaConsenso: consenso.enforcementAttivo ? 0 : consenso.senzaConsenso.length,
  })
}
