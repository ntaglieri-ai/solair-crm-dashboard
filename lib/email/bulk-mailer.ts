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
import { idsConConsensoEmail, type ConsentEntita } from "./consent"
import { leggiConsensoEnforcement } from "./consent-enforcement"

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
  /**
   * Destinatari saltati alla ri-verifica del consenso, cioe' consenzienti
   * all'accodamento e non piu' al momento dell'invio.
   */
  revocatiInCorsa: number
}

export async function sendBulkEmails(params: {
  smtpUser?: string
  smtpPassword?: string
  subject: string
  template: string
  recipients: BulkRecipient[]
  /**
   * Entita' su cui ri-verificare il consenso appena prima di spedire, `null`
   * per i destinatari a cui il consenso non si applica (installatori).
   * Obbligatorio e non opzionale di proposito: un nuovo chiamante deve essere
   * costretto a dichiarare cosa sta inviando, non a dimenticarsene.
   */
  consentEntita: ConsentEntita | null
  /**
   * Invocata dopo ogni invio. Il chiamante decide la frequenza di scrittura su
   * DB (vedi lib/email/bulk-job-store.ts): qui non si fa throttling.
   */
  onProgress?: (progress: BulkProgress) => void | Promise<void>
}): Promise<BulkSendOutcome> {
  // Secondo controllo del consenso, dopo quello di resolveBulkRecipients.
  // Non e' ridondante: un job di 100 destinatari con il ritmo prudente dura
  // minuti, e in quei minuti un consenso puo' essere revocato.
  // L'interruttore globale viene riletto qui e non ereditato dal chiamante:
  // se qualcuno RIACCENDE il blocco mentre il job e' in corso, le email
  // ancora da spedire devono tornare sotto filtro.
  const { attivo: enforcementAttivo } = await leggiConsensoEnforcement()

  let ammessi: Set<string> | null = null
  if (params.consentEntita && enforcementAttivo) {
    const { consenzienti, error } = await idsConConsensoEmail({
      entita: params.consentEntita,
      ids: params.recipients.map((recipient) => recipient.id),
    })
    if (error || !consenzienti) {
      // Fail closed: non si spedisce niente se il consenso non e'
      // verificabile. L'errore risale al chiamante, che chiude il job in
      // errore invece di segnare "completato, 0 inviate".
      throw new Error(
        `Consenso email non verificabile, invio interrotto: ${error ?? "esito vuoto"}`,
      )
    }
    ammessi = consenzienti
  }

  const policy = await getCommunicationEmailPolicy()
  const outbound = createAgentOutboundTransport({
    smtpUser: params.smtpUser,
    smtpPassword: params.smtpPassword,
    policy,
    replyToMode: policy.bulkReplyTo === "azienda" ? "company" : "agent",
  })

  let inviate = 0
  let fallite = 0
  let revocatiInCorsa = 0
  const errori: string[] = []

  for (const recipient of params.recipients) {
    if (ammessi && !ammessi.has(recipient.id)) {
      revocatiInCorsa++
      console.warn(
        `[consenso-email] ${recipient.id} saltato: consenso non piu' valido alla ri-verifica pre-invio`,
      )
      continue
    }

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
    await sleep(outbound.pacingMs)
  }

  outbound.transport.close()
  return { inviate, fallite, errori, revocatiInCorsa }
}
