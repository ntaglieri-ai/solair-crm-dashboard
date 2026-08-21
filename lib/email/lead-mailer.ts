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
import {
  DEFAULT_COMMUNICATION_EMAIL_POLICY,
  getCommunicationEmailPolicy,
  type CommunicationEmailPolicy,
} from "./communication-policy"
import { textToSafeHtml } from "./html"

const ARUBA_HOST = "smtps.aruba.it"
const ARUBA_PORT = 465
const MAX_RECIPIENTS_PER_REQUEST = 200

/** Pausa tra un destinatario e l'altro: mantiene prudente anche il fallback Aruba. */
export const PACING_MS = 400
const SES_PACING_MS = 120

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
  fromEmail: string
  fromName: string
}

type OutboundTransport = {
  transport: Transporter
  from: string
  replyTo?: string
  pacingMs: number
  provider: "ses" | "smtp" | "personal-aruba"
}

function formatAddress(email: string, name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) return email
  const safeName = trimmedName.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")
  return `"${safeName}" <${email}>`
}

function systemSmtpConfig(
  policy: CommunicationEmailPolicy = DEFAULT_COMMUNICATION_EMAIL_POLICY,
): SystemSmtpConfig | null {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const fromEmail = policy.fromEmail || process.env.SMTP_FROM
  if (provider !== "ses" && !(host && port && user && password && fromEmail)) return null
  if (!host || !port || !user || !password || !fromEmail) return null

  return { host, port: Number(port), user, password, fromEmail, fromName: policy.fromName }
}

export function hasSystemOutboundSmtp(policy?: CommunicationEmailPolicy): boolean {
  return Boolean(systemSmtpConfig(policy))
}

/**
 * Transport unico per invii agenti/massa. Con SES configurato usa SMTP_*, ma
 * conserva la conversazione verso l'agente tramite Reply-To.
 */
export function createAgentOutboundTransport(params: {
  smtpUser?: string
  smtpPassword?: string
  policy?: CommunicationEmailPolicy
  replyToMode?: "agent" | "company"
}): OutboundTransport {
  const policy = params.policy ?? DEFAULT_COMMUNICATION_EMAIL_POLICY
  const system = systemSmtpConfig(policy)
  if (system) {
    const companyReplyTo = policy.replyTo || system.fromEmail
    const replyTo =
      params.replyToMode === "company" ? companyReplyTo : params.smtpUser || companyReplyTo

    return {
      transport: nodemailer.createTransport({
        host: system.host,
        port: system.port,
        secure: system.port === 465,
        auth: { user: system.user, pass: system.password },
      }),
      from: formatAddress(system.fromEmail, system.fromName),
      replyTo,
      pacingMs: policy.bulkPacing === "prudente" ? PACING_MS : SES_PACING_MS,
      provider: process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "ses" ? "ses" : "smtp",
    }
  }

  if (!params.smtpUser || !params.smtpPassword) {
    throw new Error("SMTP personale non configurato e SMTP di sistema non disponibile")
  }

  return {
    transport: createPersonalTransport(params.smtpUser, params.smtpPassword),
    from: params.smtpUser,
    pacingMs: PACING_MS,
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
  const policy = await getCommunicationEmailPolicy()

  const outbound = createAgentOutboundTransport({
    smtpUser: params.smtpUser,
    smtpPassword: params.smtpPassword,
    policy,
    replyToMode: "agent",
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
    await sleep(outbound.pacingMs)
  }

  outbound.transport.close()
  return { results, truncated }
}
