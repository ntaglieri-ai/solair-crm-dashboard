// Invio email a lead/clienti a nome dell'agente, usando la SUA casella
// Aruba personale (non la casella di sistema commerciale@solairgroup.it di
// lib/email/mailer.ts — quella e' solo per email transazionali interne).
//
// IMPORTANTE: una casella Aruba personale non e' pensata per invii di massa
// — gli hosting condivisi tipicamente limitano gli invii orari (spesso
// nell'ordine di 100-150/ora) e un burst di invii ravvicinati rischia di far
// segnalare la casella come sospetta. Per questo l'invio qui e' SEQUENZIALE
// con una piccola pausa tra un destinatario e l'altro, invece che in
// parallelo — piu' lento ma molto piu' sicuro per la reputazione della
// casella personale dell'agente.

import nodemailer from "nodemailer"

const ARUBA_HOST = "smtps.aruba.it"
const ARUBA_PORT = 465
const PACING_MS = 400
const MAX_RECIPIENTS_PER_REQUEST = 200

export type LeadEmailResult = {
  to: string
  ok: boolean
  error: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  const transport = nodemailer.createTransport({
    host: ARUBA_HOST,
    port: ARUBA_PORT,
    secure: true,
    auth: { user: params.smtpUser, pass: params.smtpPassword },
  })

  const results: LeadEmailResult[] = []
  for (const to of recipients) {
    try {
      await transport.sendMail({
        from: params.smtpUser,
        to,
        subject: params.subject,
        text: params.body,
        html: params.body.replace(/\n/g, "<br/>"),
      })
      results.push({ to, ok: true, error: null })
    } catch (e) {
      results.push({ to, ok: false, error: e instanceof Error ? e.message : "Errore invio" })
    }
    await sleep(PACING_MS)
  }

  return { results, truncated }
}
