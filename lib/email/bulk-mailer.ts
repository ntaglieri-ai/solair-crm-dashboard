// Invio di MASSA a nome operativo dell'agente (Lead / Clienti / Installatori).
//
// Riusa il transport di lib/email/lead-mailer.ts: SES/SMTP di sistema quando
// configurato, Reply-To personale dell'agente, fallback Aruba personale solo
// se SES non e' disponibile.
//
// Questo modulo NON va invocato dentro una richiesta HTTP sincrona: gli invii
// massa restano lavoro da after(), con ritmo deciso dalla policy Comunicazioni.

import { createAgentOutboundTransport, sleep } from "./lead-mailer"
import { getCommunicationEmailPolicy } from "./communication-policy"
import { type BulkPlaceholder, renderTemplate } from "./bulk-template"
import { textToSafeHtml } from "./html"
import type { ConsentEntita } from "./consent"

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
  /**
   * Chi ha ricevuto davvero, per lo storico invii. Non ricavabile dai soli
   * contatori: i saltati per consenso revocato e i falliti non ci sono.
   */
  destinatariRaggiunti: Array<{ id: string; email: string }>
  /** Mittente realmente usato per il batch. */
  fromEmail: string
  fromName: string | null
  /** Primi errori distinti, per il log server (non esposti in UI). */
  errori: string[]
  /** Compatibilita' con il vecchio esito: il consenso non salta destinatari. */
  revocatiInCorsa: number
}

export async function sendBulkEmails(params: {
  smtpUser?: string
  smtpPassword?: string
  /**
   * Casella mittente scelta in fase di composizione: la STESSA per tutto il
   * batch, non per destinatario. Assente = mittente di sistema.
   */
  fromEmail?: string | null
  fromName?: string | null
  subject: string
  template: string
  recipients: BulkRecipient[]
  /** Dato mantenuto per compatibilita': non attiva filtri di consenso. */
  consentEntita: ConsentEntita | null
  /**
   * Invocata dopo ogni invio. Il chiamante decide la frequenza di scrittura su
   * DB (vedi lib/email/bulk-job-store.ts): qui non si fa throttling.
   */
  onProgress?: (progress: BulkProgress) => void | Promise<void>
}): Promise<BulkSendOutcome> {
  void params.consentEntita

  const policy = await getCommunicationEmailPolicy()
  const outbound = createAgentOutboundTransport({
    smtpUser: params.smtpUser,
    smtpPassword: params.smtpPassword,
    policy,
    replyToMode: policy.bulkReplyTo === "azienda" ? "company" : "agent",
    fromEmail: params.fromEmail,
    fromName: params.fromName,
  })

  let inviate = 0
  let fallite = 0
  const errori: string[] = []
  const destinatariRaggiunti: Array<{ id: string; email: string }> = []

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
      destinatariRaggiunti.push({ id: recipient.id, email: recipient.email })
    } catch (error) {
      fallite++
      const message = error instanceof Error ? error.message : "Errore invio"
      if (errori.length < 5 && !errori.includes(message)) errori.push(message)
      console.error(`[email-massa] invio a ${recipient.email} fallito:`, message)
    }

    await params.onProgress?.({ inviate, fallite })
    await sleep(outbound.pacingMs)
  }

  outbound.transport.close()
  return {
    inviate,
    fallite,
    errori,
    revocatiInCorsa: 0,
    destinatariRaggiunti,
    fromEmail: outbound.fromEmail,
    fromName: outbound.fromName,
  }
}
