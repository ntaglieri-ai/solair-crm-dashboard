import { bodyToText, escapeHtml, isHtmlBody, textToSafeHtml } from "./html"

/**
 * L'involucro delle email Solair.
 *
 * I modelli importati da Zoho sono pagine generate dal loro editor: tabelle
 * annidate, fogli di stile lunghi trentamila caratteri, media query. Difficili
 * da modificare senza rompere l'impaginazione, e illeggibili nell'anteprima.
 *
 * Qui l'involucro e' uno solo: intestazione con il logo, corpo, piede con i
 * dati aziendali. Quello che cambia da un modello all'altro e' il testo.
 *
 * Le scelte tecniche sono dettate dai programmi di posta, non dal gusto:
 * tabelle invece di flexbox, stili in linea invece di classi, larghezza fissa
 * a 600 pixel. Outlook e Gmail ignorano buona parte del CSS moderno, e un
 * layout che si vede bene nel browser puo' arrivare a pezzi nella casella.
 */

export type AziendaEmail = {
  nome: string
  piva: string
  codiceFiscale: string
  email: string
  telefono: string
  whatsapp: string
  sito: string
  privacy: string
  sedeLegale: string
  sedi: string
  logo: string
}

/** Dati aziendali di fallback, usati se CRM Settings non e' compilato. */
export const AZIENDA: AziendaEmail = {
  nome: "Solair Group S.r.l.",
  piva: "06056640870",
  codiceFiscale: "",
  email: "info@solairgroup.it",
  telefono: "+39 095 290 0274",
  whatsapp: "+39 095 290 0278",
  sito: "https://solairgroup.it",
  privacy: "https://www.iubenda.com/privacy-policy/56116406",
  sedeLegale: "",
  sedi: "Catania · Giarre (CT) · Treviso (TV) · Torino (TO) · Porto Sant'Elpidio (FM)",
  // Ospitato pubblicamente: nelle email un'immagine deve avere un indirizzo
  // raggiungibile da fuori, un file del progetto non basta.
  logo:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp_Image_2026-05-05_at_18.34.28-removebg-preview-rlWc3q38NGodyFUqcCA2TsRp7eyfiY.png",
}

type CompanyProfileSettings = {
  legalName?: unknown
  vatNumber?: unknown
  taxCode?: unknown
  email?: unknown
  phone?: unknown
  website?: unknown
  registeredOffice?: unknown
  logoUrl?: unknown
}

const COLORI = {
  testo: "#1f2937",
  tenue: "#6b7280",
  bordo: "#e5e7eb",
  sfondo: "#f4f6f8",
  scuro: "#12293f",
  accento: "#2e8b72",
} as const

const FONT = "Arial, Helvetica, sans-serif"

function stringa(valore: unknown): string {
  return typeof valore === "string" ? valore.trim() : ""
}

function valoreConFallback(valore: unknown, fallback: string): string {
  const pulito = stringa(valore)
  return pulito || fallback
}

function logoEmail(valore: unknown): string {
  const logo = stringa(valore)
  if (/^https?:\/\//i.test(logo)) return logo
  return AZIENDA.logo
}

function sitoPulito(valore: string): string {
  return valore.replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

export function aziendaDaProfilo(profilo: unknown): AziendaEmail {
  const raw = profilo && typeof profilo === "object" ? (profilo as CompanyProfileSettings) : {}
  return {
    ...AZIENDA,
    nome: valoreConFallback(raw.legalName, AZIENDA.nome),
    piva: valoreConFallback(raw.vatNumber, AZIENDA.piva),
    codiceFiscale: stringa(raw.taxCode),
    email: valoreConFallback(raw.email, AZIENDA.email),
    telefono: valoreConFallback(raw.phone, AZIENDA.telefono),
    sito: valoreConFallback(raw.website, AZIENDA.sito),
    sedeLegale: stringa(raw.registeredOffice),
    logo: logoEmail(raw.logoUrl),
  }
}

/**
 * Il corpo, a partire da testo semplice.
 *
 * Le righe vuote separano i paragrafi, come ci si aspetta scrivendo: chi
 * compone un modello non deve pensare in termini di markup.
 */
export function paragrafiDaTesto(testo: string): string {
  return normalizzaTestoEmail(testo)
    .split(/\n\s*\n/)
    .map((blocco) => blocco.trim())
    .filter(Boolean)
    .map(
      (blocco) =>
        `<p style="margin:0 0 14px;font-family:${FONT};font-size:14px;line-height:1.58;color:${COLORI.testo}">${textToSafeHtml(
          blocco,
        )}</p>`,
    )
    .join("\n")
}

function normalizzaTestoEmail(testo: string): string {
  return testo
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;!?])(?=\S)/g, "$1 ")
    .replace(/:(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g, ": ")
    .replace(/\.([A-ZÀ-Ö][a-zà-öø-ÿ])/g, ". $1")
    .replace(/\bN\.\s+B\./g, "N.B.")
    .replace(/([A-Za-zÀ-ÖØ-öø-ÿ])([’'])\s+/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Avvolge un corpo nell'involucro Solair.
 *
 * `corpo` puo' essere HTML gia' pronto oppure testo semplice: nel secondo
 * caso viene diviso in paragrafi. Chi scrive un modello nuovo passa testo,
 * la conversione da Zoho passa i paragrafi gia' composti.
 */
export function modelloBase(corpo: string, azienda: AziendaEmail = AZIENDA): string {
  const contenuto = isHtmlBody(corpo) ? corpo : paragrafiDaTesto(corpo)
  const websiteLabel = sitoPulito(azienda.sito)
  const telHref = azienda.telefono.replace(/\s/g, "")
  const whatsappHref = azienda.whatsapp.replace(/[^\d]/g, "")
  const sede = azienda.sedeLegale || azienda.sedi
  const nome = escapeHtml(azienda.nome)
  const email = escapeHtml(azienda.email)
  const telefono = escapeHtml(azienda.telefono)
  const whatsapp = escapeHtml(azienda.whatsapp)
  const sito = escapeHtml(azienda.sito)
  const sitoLabel = escapeHtml(websiteLabel)
  const sedeTesto = escapeHtml(sede)
  const logo = escapeHtml(azienda.logo)
  const datiFiscali = [
    azienda.piva ? `P.IVA ${azienda.piva}` : "",
    azienda.codiceFiscale ? `C.F. ${azienda.codiceFiscale}` : "",
  ].filter(Boolean).join(" · ")
  const datiFiscaliHtml = escapeHtml(datiFiscali)

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nome}</title>
</head>
<body style="margin:0;padding:0;background:${COLORI.sfondo};font-family:${FONT};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORI.sfondo};font-family:${FONT}">
<tr>
<td align="center" style="padding:24px 12px">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${COLORI.bordo};border-radius:10px;overflow:hidden;font-family:${FONT}">

<tr>
<td style="background:#ffffff;padding:22px 30px 18px">
<img src="${logo}" alt="${nome}" width="168" style="display:block;width:168px;max-width:168px;height:auto;border:0">
</td>
</tr>

<tr>
<td style="height:4px;background:${COLORI.accento};font-size:0;line-height:0">&nbsp;</td>
</tr>

<tr>
<td style="padding:30px 32px 22px;font-family:${FONT}">
${contenuto}
</td>
</tr>

<tr>
<td style="padding:0 32px 30px;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-top:1px solid ${COLORI.bordo};padding-top:16px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLORI.testo}"><strong>${nome}</strong></p>
<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLORI.tenue}">
Tel. <a href="tel:${telHref}" style="color:${COLORI.tenue};text-decoration:none">${telefono}</a>
&nbsp;·&nbsp; WhatsApp <a href="https://wa.me/${whatsappHref}" style="color:${COLORI.tenue};text-decoration:none">${whatsapp}</a>
</p>
<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLORI.tenue}">
<a href="mailto:${email}" style="color:${COLORI.accento};text-decoration:none">${email}</a>
&nbsp;·&nbsp; <a href="${sito}" style="color:${COLORI.accento};text-decoration:none">${sitoLabel}</a>
</p>
<p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.5;color:${COLORI.tenue}">${sedeTesto}</p>
</td></tr>
</table>
</td>
</tr>

</table>

<p style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${COLORI.tenue};text-align:center">
${nome}${datiFiscaliHtml ? ` — ${datiFiscaliHtml}` : ""}<br>
<a href="${azienda.privacy}" style="color:${COLORI.tenue}">Informativa privacy</a>
</p>

</td>
</tr>
</table>
</body>
</html>`
}

/**
 * Converte un modello Zoho nell'involucro Solair.
 *
 * Del modello originale si tiene il TESTO, non l'impaginazione: quella e'
 * generata dal loro editor e non sopravvive a un travaso. E' una perdita
 * consapevole — su un avviso di mancato incasso non serve, su un volantino
 * promozionale si', ed e' per questo che la conversione non tocca gli
 * originali ma crea modelli affiancati.
 */
export function convertiDaZoho(htmlZoho: string, azienda: AziendaEmail = AZIENDA): string {
  return modelloBase(paragrafiDaTesto(bodyToText(htmlZoho)), azienda)
}
