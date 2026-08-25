// Invio email transazionali via SMTP (nodemailer), oggi Amazon SES con il
// dominio solairgroup.it verificato per intero.
//
// `fromEmail` e' opzionale su tutte le funzioni di questo modulo: valorizzato
// sostituisce il solo header From (le credenziali SMTP restano quelle di
// sistema, il dominio e' gia' verificato); assente lascia SMTP_FROM, che e' il
// caso delle email automatiche — benvenuto e reset password partono dal
// mittente di sistema e non sono toccate dalla scelta del mittente.
import nodemailer, { type Transporter } from "nodemailer"
import { escapeHtml } from "./html"

type SmtpConfig = {
  host: string
  port: number
  user: string
  password: string
  from: string
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !password || !from) return null
  return { host, port: Number(port), user, password, from }
}

let cachedTransport: Transporter | null = null
let cachedKey: string | null = null

function getTransport(cfg: SmtpConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.password },
    })
    cachedKey = key
  }
  return cachedTransport
}

function loginUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://solair-crm-dashboard.vercel.app"
  return `${base}/login`
}

export async function sendWelcomeEmail(params: {
  to: string
  nome: string
  tempPassword: string
  /** Mittente alternativo; assente = SMTP_FROM, comportamento invariato. */
  fromEmail?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const cfg = smtpConfig()
  if (!cfg) {
    return {
      ok: false,
      error: "SMTP non configurato (SMTP_HOST/PORT/USER/PASSWORD/FROM mancanti)",
    }
  }

  try {
    const transport = getTransport(cfg)
    const safeNome = escapeHtml(params.nome)
    const safeTo = escapeHtml(params.to)
    const safeTempPassword = escapeHtml(params.tempPassword)
    const safeLoginUrl = escapeHtml(loginUrl())
    await transport.sendMail({
      from: params.fromEmail || cfg.from,
      to: params.to,
      subject: "Il tuo accesso a Solair CRM",
      text: [
        `Ciao ${params.nome},`,
        "",
        "Il tuo account Solair CRM e' stato creato.",
        "",
        `Email: ${params.to}`,
        `Password temporanea: ${params.tempPassword}`,
        "",
        "Al primo accesso ti verra' chiesto di impostare una nuova password.",
        "",
        `Accedi qui: ${loginUrl()}`,
      ].join("\n"),
      html: `
        <p>Ciao ${safeNome},</p>
        <p>Il tuo account Solair CRM e' stato creato.</p>
        <p>
          Email: <strong>${safeTo}</strong><br/>
          Password temporanea: <strong>${safeTempPassword}</strong>
        </p>
        <p>Al primo accesso ti verra' chiesto di impostare una nuova password.</p>
        <p><a href="${safeLoginUrl}">Accedi al CRM</a></p>
      `,
    })
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore invio email" }
  }
}

export async function sendPasswordResetEmail(params: {
  to: string
  nome: string
  tempPassword: string
  /** Mittente alternativo; assente = SMTP_FROM, comportamento invariato. */
  fromEmail?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const cfg = smtpConfig()
  if (!cfg) {
    return {
      ok: false,
      error: "SMTP non configurato (SMTP_HOST/PORT/USER/PASSWORD/FROM mancanti)",
    }
  }

  try {
    const transport = getTransport(cfg)
    const safeNome = escapeHtml(params.nome)
    const safeTo = escapeHtml(params.to)
    const safeTempPassword = escapeHtml(params.tempPassword)
    const safeLoginUrl = escapeHtml(loginUrl())
    await transport.sendMail({
      from: params.fromEmail || cfg.from,
      to: params.to,
      subject: "Reimposta la password di Solair CRM",
      text: [
        `Ciao ${params.nome},`,
        "",
        "Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account Solair CRM.",
        "",
        `Email: ${params.to}`,
        `La tua nuova password temporanea: ${params.tempPassword}`,
        "",
        "Al prossimo accesso ti verra' chiesto di impostare una nuova password.",
        "",
        "Se non hai richiesto tu il reset, contatta subito un amministratore: la password precedente e' stata sostituita.",
        "",
        `Accedi qui: ${loginUrl()}`,
      ].join("\n"),
      html: `
        <p>Ciao ${safeNome},</p>
        <p>Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account Solair CRM.</p>
        <p>
          Email: <strong>${safeTo}</strong><br/>
          La tua nuova password temporanea: <strong>${safeTempPassword}</strong>
        </p>
        <p>Al prossimo accesso ti verra' chiesto di impostare una nuova password.</p>
        <p>Se non hai richiesto tu il reset, contatta subito un amministratore: la password precedente e' stata sostituita.</p>
        <p><a href="${safeLoginUrl}">Accedi al CRM</a></p>
      `,
    })
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore invio email" }
  }
}
