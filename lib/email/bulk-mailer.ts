// Invio di MASSA a nome dell'agente (Lead / Clienti / Installatori).
//
// Riusa integralmente il transport e il pacing di lib/email/lead-mailer.ts —
// stessa casella Aruba personale, stessa pausa di 400ms tra un destinatario e
// l'altro: qui cambia solo che il corpo e' un TEMPLATE con placeholder
// risolti per destinatario, e che l'avanzamento viene notificato al chiamante
// (che lo persiste su email_massa_jobs per la barra di progresso in UI).
//
// Questo modulo NON va invocato dentro una richiesta HTTP sincrona: 100
// destinatari x 400ms = 40s+ di lavoro. Va sempre dentro after().

import { PACING_MS, createPersonalTransport, sleep } from "./lead-mailer"
import { type BulkPlaceholder, renderTemplate } from "./bulk-template"

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
  const transport = createPersonalTransport(params.smtpUser, params.smtpPassword)

  let inviate = 0
  let fallite = 0
  const errori: string[] = []

  for (const recipient of params.recipients) {
    const body = renderTemplate(params.template, recipient.placeholders)
    const subject = renderTemplate(params.subject, recipient.placeholders)

    try {
      await transport.sendMail({
        from: params.smtpUser,
        to: recipient.email,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br/>"),
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

  transport.close()
  return { inviate, fallite, errori }
}
