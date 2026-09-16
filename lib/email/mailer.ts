// Invio email transazionali via SMTP (nodemailer), oggi Amazon SES con il
// dominio solairgroup.it verificato per intero.
//
// `fromEmail` e' opzionale su tutte le funzioni di questo modulo: valorizzato
// sostituisce il solo header From (le credenziali SMTP restano quelle di
// sistema, il dominio e' gia' verificato); assente lascia SMTP_FROM, che e' il
// caso delle email automatiche — benvenuto e reset password partono dal
// mittente di sistema e non sono toccate dalla scelta del mittente.
import { bodyToHtml, bodyToText } from "./html"
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
  return crmRecordUrl("/login")
}

/** Il CRM in assoluto, per le email che partono fuori da una richiesta HTTP. */
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://solair-crm-dashboard.vercel.app"
  )
}

export function crmRecordUrl(pathname: string): string {
  return `${siteUrl()}${pathname}`
}

/**
 * L'anteprima della nota dentro l'email.
 *
 * La mail di notifica deve dire di cosa si parla senza costringere ad aprire
 * il CRM, ma non e' il posto per una nota lunga: viene troncata all'ultimo
 * spazio utile, cosi' non si spezza una parola a meta'.
 */
export function notePreview(text: string, maxLength = 400): string {
  const normalized = text.replace(/\r\n|\r/g, "\n").trim()
  if (normalized.length <= maxLength) return normalized
  const cut = normalized.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}

export async function sendMentionNotificationEmail(params: {
  to: string
  recipientName: string
  authorName: string
  noteText: string
  /** Tipo di scheda: "Cliente", "Lead", "Compito", "Installatore". */
  recordLabel: string
  /** Nome della scheda — senza, la mail non dice su CHI e' la nota. */
  recordName?: string | null
  recordUrl: string
  /** "una nota" (timeline) oppure "una nota interna". */
  noteKind?: string
}): Promise<{ ok: boolean; error: string | null }> {
  const cfg = smtpConfig()
  if (!cfg) return { ok: false, error: "SMTP non configurato" }

  try {
    const transport = getTransport(cfg)
    const kind = params.noteKind || "una nota"
    const name = params.recordName?.trim() || ""
    // "Cliente Antonino Molino" quando il nome c'e', "Cliente" quando manca:
    // meglio la sola etichetta che un "Cliente —" con il posto vuoto.
    const record = name ? `${params.recordLabel} ${name}` : params.recordLabel
    const preview = notePreview(params.noteText)
    const safeRecipient = escapeHtml(params.recipientName)
    const safeAuthor = escapeHtml(params.authorName)
    const safeText = escapeHtml(preview).replace(/\n/g, "<br/>")
    const safeLabel = escapeHtml(params.recordLabel)
    const safeName = escapeHtml(name)
    const safeRecord = escapeHtml(record)
    const safeUrl = escapeHtml(params.recordUrl)
    await transport.sendMail({
      from: cfg.from,
      to: params.to,
      // Il nome della scheda sta nell'oggetto: la notifica si riconosce
      // dall'elenco della posta, senza aprirla.
      subject: `${params.authorName} ti ha menzionato in ${kind} — ${record}`,
      text: [
        `Ciao ${params.recipientName},`,
        "",
        `${params.authorName} ti ha menzionato in ${kind} su ${record}.`,
        "",
        `${params.recordLabel}: ${name || "non disponibile"}`,
        "",
        "Nota:",
        preview,
        "",
        `Apri la scheda: ${params.recordUrl}`,
      ].join("\n"),
      html: `
        <p>Ciao ${safeRecipient},</p>
        <p><strong>${safeAuthor}</strong> ti ha menzionato in ${escapeHtml(kind)} su <strong>${safeRecord}</strong>.</p>
        <p style="margin:16px 0;color:#525252">${safeLabel}: <strong>${safeName || "non disponibile"}</strong></p>
        <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0f766e;background:#f5f5f5">${safeText}</blockquote>
        <p><a href="${safeUrl}">Apri la scheda nel CRM</a></p>
      `,
    })
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Errore invio email" }
  }
}

export async function sendDirectEmail(params: {
  to: string
  subject: string
  body: string
  fromEmail?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const cfg = smtpConfig()
  if (!cfg) return { ok: false, error: "SMTP non configurato" }
  try {
    await getTransport(cfg).sendMail({
      from: params.fromEmail || cfg.from,
      to: params.to,
      subject: params.subject,
      // Un corpo gia' HTML (un modello) si spedisce com'e'; uno scritto a
      // mano viene neutralizzato e mandato a capo. Trattarli allo stesso
      // modo faceva arrivare i modelli con i tag in chiaro.
      text: bodyToText(params.body),
      html: bodyToHtml(params.body),
    })
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Errore invio email" }
  }
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
