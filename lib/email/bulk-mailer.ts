// Invio di MASSA a nome operativo dell'agente (Lead / Clienti / Installatori).
//
// Riusa il transport di lib/email/lead-mailer.ts: SES/SMTP di sistema quando
// configurato, Reply-To personale dell'agente, fallback Aruba personale solo
// se SES non e' disponibile.
//
// Questo modulo NON va invocato dentro una richiesta HTTP sincrona: 100
// destinatari x 400ms = 40s+ di lavoro. Va sempre dentro after().

import { PACING_MS, createAgentOutboundTransport, sleep } from "./lead-mailer"
import { type BulkPlaceholder, renderTemplate } from "./bulk-template"
import { textToSafeHtml } from "./html"

export type BulkRecipient = {
  /** Id del record sorgente (lead/cliente/installatore) — solo per i log. */
  id: string
  email: string
  placeholders: Record<BulkPlaceholder, string>
}

export type BulkProgress = {
  inviate: number
  fallite: number
}

export type BulkSendOutcome = {
  inviate: number
  fallite: number
  /** Primi errori distinti, per il log server (non esposti in UI). */
  errori: string[]
}

export async function sendBulkEmails(params: {
  smtpUser: string
  smtpPassword: string
  subject: string
  template: string
  recipients: BulkRecipient[]
  /**
   * Invocata dopo ogni invio. Il chiamante decide la frequenza di scrittura su
   * DB (vedi lib/email/bulk-job-store.ts): qui non si fa throttling.
   */
  onProgress?: (progress: BulkProgress) => void | Promise<void>
}): Promise<BulkSendOutcome> {
  const outbound = createAgentOutboundTransport({
    smtpUser: params.smtpUser,
    smtpPassword: params.smtpPassword,
  })

  let inviate = 0
  let fallite = 0
  const errori: string[] = []

  for (const recipient of params.recipients) {
    const body = renderTemplate(params.template, recipient.placeholders)
    const subject = renderTemplate(params.subject, recipient.placeholders)

    try {
      await outbound.transport.sendMail({
        from: outbound.from,
        replyTo: outbound.replyTo,
        to: recipient.email,
        subject,
        text: body,
        html: textToSafeHtml(body),
      })
      inviate++
    } catch (error) {
      fallite++
      const message = error instanceof Error ? error.message : "Errore invio"
      if (errori.length < 5 && !errori.includes(message)) errori.push(message)
      console.error(`[email-massa] invio a ${recipient.email} fallito:`, message)
    }

    await params.onProgress?.({ inviate, fallite })
    await sleep(PACING_MS)
  }

  outbound.transport.close()
  return { inviate, fallite, errori }
}
