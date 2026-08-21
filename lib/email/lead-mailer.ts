// Invio email a lead/clienti a nome operativo dell'agente.
//
// Priorita':
// 1. SES / SMTP di sistema quando EMAIL_PROVIDER=ses oppure SMTP_* e' completo.
//    From resta una casella Solair verificata, Reply-To e' la mail personale
//    dell'agente.
// 2. Fallback sulla casella personale Aruba dell'agente solo se SES/SMTP non e'
//    configurato.

import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"
import { textToSafeHtml } from "./html"

const ARUBA_HOST = "smtps.aruba.it"
const ARUBA_PORT = 465
const MAX_RECIPIENTS_PER_REQUEST = 200

/** Pausa tra un destinatario e l'altro: mantiene prudente anche il fallback Aruba. */
export const PACING_MS = 400

export type LeadEmailResult = {
  to: string
  ok: boolean
  error: string | null
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Transport SMTP sulla casella Aruba personale dell'agente. Condiviso con
 * lib/email/bulk-mailer.ts: host/porta/TLS vivono solo qui.
 */
export function createPersonalTransport(smtpUser: string, smtpPassword: string): Transporter {
  return nodemailer.createTransport({
    host: ARUBA_HOST,
    port: ARUBA_PORT,
    secure: true,
    auth: { user: smtpUser, pass: smtpPassword },
  })
}

type SystemSmtpConfig = {
  host: string
  port: number
  user: string
  password: string
  from: string
}

type OutboundTransport = {
  transport: Transporter
  from: string
  replyTo?: string
  provider: "ses" | "smtp" | "personal-aruba"
}

function systemSmtpConfig(): SystemSmtpConfig | null {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM
  if (provider !== "ses" && !(host && port && user && password && from)) return null
  if (!host || !port || !user || !password || !from) return null

  return { host, port: Number(port), user, password, from }
}

/**
 * Transport unico per invii agenti/massa. Con SES configurato usa SMTP_*, ma
 * conserva la conversazione verso l'agente tramite Reply-To.
 */
export function createAgentOutboundTransport(params: {
  smtpUser: string
  smtpPassword: string
}): OutboundTransport {
  const system = systemSmtpConfig()
  if (system) {
    return {
      transport: nodemailer.createTransport({
        host: system.host,
        port: system.port,
        secure: system.port === 465,
        auth: { user: system.user, pass: system.password },
      }),
      from: system.from,
      replyTo: params.smtpUser,
      provider: process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "ses" ? "ses" : "smtp",
    }
  }

  return {
    transport: createPersonalTransport(params.smtpUser, params.smtpPassword),
    from: params.smtpUser,
    provider: "personal-aruba",
  }
}

export async function sendLeadEmails(params: {
  smtpUser: string
  smtpPassword: string
  recipients: string[]
  subject: string
  body: string
}): Promise<{ results: LeadEmailResult[]; truncated: boolean }> {
  const truncated = params.recipients.length > MAX_RECIPIENTS_PER_REQUEST
  const recipients = params.recipients.slice(0, MAX_RECIPIENTS_PER_REQUEST)

  const outbound = createAgentOutboundTransport({
    smtpUser: params.smtpUser,
    smtpPassword: params.smtpPassword,
  })

  const results: LeadEmailResult[] = []
  for (const to of recipients) {
    try {
      await outbound.transport.sendMail({
        from: outbound.from,
        replyTo: outbound.replyTo,
        to,
        subject: params.subject,
        text: params.body,
        html: textToSafeHtml(params.body),
      })
      results.push({ to, ok: true, error: null })
    } catch (e) {
      results.push({ to, ok: false, error: e instanceof Error ? e.message : "Errore invio" })
    }
    await sleep(PACING_MS)
  }

  outbound.transport.close()
  return { results, truncated }
}
