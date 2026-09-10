import { bodyToText, isHtmlBody, textToSafeHtml } from "./html"

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

/** Dati aziendali, da solairgroup.it. */
export const AZIENDA = {
  nome: "Solair Group S.r.l.",
  piva: "06056640870",
  email: "info@solairgroup.it",
  telefono: "+39 095 290 0274",
  whatsapp: "+39 095 290 0278",
  sito: "https://solairgroup.it",
  privacy: "https://www.iubenda.com/privacy-policy/56116406",
  sedi: "Catania · Giarre (CT) · Treviso (TV) · Torino (TO) · Porto Sant'Elpidio (FM)",
  // Ospitato pubblicamente: nelle email un'immagine deve avere un indirizzo
  // raggiungibile da fuori, un file del progetto non basta.
  logo:
    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp_Image_2026-05-05_at_18.34.28-removebg-preview-rlWc3q38NGodyFUqcCA2TsRp7eyfiY.png",
} as const

const COLORI = {
  testo: "#1f2937",
  tenue: "#6b7280",
  bordo: "#e5e7eb",
  sfondo: "#f4f6f8",
  scuro: "#12293f",
  accento: "#2e8b72",
} as const

/**
 * Il corpo, a partire da testo semplice.
 *
 * Le righe vuote separano i paragrafi, come ci si aspetta scrivendo: chi
 * compone un modello non deve pensare in termini di markup.
 */
export function paragrafiDaTesto(testo: string): string {
  return testo
    .split(/\n\s*\n/)
    .map((blocco) => blocco.trim())
    .filter(Boolean)
    .map(
      (blocco) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORI.testo}">${textToSafeHtml(
          blocco,
        )}</p>`,
    )
    .join("\n")
}

/**
 * Avvolge un corpo nell'involucro Solair.
 *
 * `corpo` puo' essere HTML gia' pronto oppure testo semplice: nel secondo
 * caso viene diviso in paragrafi. Chi scrive un modello nuovo passa testo,
 * la conversione da Zoho passa i paragrafi gia' composti.
 */
export function modelloBase(corpo: string): string {
  const contenuto = isHtmlBody(corpo) ? corpo : paragrafiDaTesto(corpo)

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${AZIENDA.nome}</title>
</head>
<body style="margin:0;padding:0;background:${COLORI.sfondo};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORI.sfondo}">
<tr>
<td align="center" style="padding:24px 12px">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${COLORI.bordo};border-radius:10px;overflow:hidden">

<tr>
<td style="background:${COLORI.scuro};padding:20px 28px">
<img src="${AZIENDA.logo}" alt="${AZIENDA.nome}" width="132" style="display:block;width:132px;max-width:132px;height:auto;border:0">
</td>
</tr>

<tr>
<td style="height:3px;background:${COLORI.accento};font-size:0;line-height:0">&nbsp;</td>
</tr>

<tr>
<td style="padding:28px">
${contenuto}
</td>
</tr>

<tr>
<td style="padding:0 28px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="border-top:1px solid ${COLORI.bordo};padding-top:16px">
<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${COLORI.testo}"><strong>${AZIENDA.nome}</strong></p>
<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${COLORI.tenue}">
Tel. <a href="tel:${AZIENDA.telefono.replace(/\s/g, "")}" style="color:${COLORI.tenue};text-decoration:none">${AZIENDA.telefono}</a>
&nbsp;·&nbsp; WhatsApp <a href="https://wa.me/${AZIENDA.whatsapp.replace(/[^\d]/g, "")}" style="color:${COLORI.tenue};text-decoration:none">${AZIENDA.whatsapp}</a>
</p>
<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${COLORI.tenue}">
<a href="mailto:${AZIENDA.email}" style="color:${COLORI.accento};text-decoration:none">${AZIENDA.email}</a>
&nbsp;·&nbsp; <a href="${AZIENDA.sito}" style="color:${COLORI.accento};text-decoration:none">solairgroup.it</a>
</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:${COLORI.tenue}">${AZIENDA.sedi}</p>
</td></tr>
</table>
</td>
</tr>

</table>

<p style="margin:14px 0 0;font-size:11px;line-height:1.5;color:${COLORI.tenue};text-align:center">
${AZIENDA.nome} — P.IVA ${AZIENDA.piva}<br>
<a href="${AZIENDA.privacy}" style="color:${COLORI.tenue}">Informativa privacy</a>
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
export function convertiDaZoho(htmlZoho: string): string {
  return modelloBase(paragrafiDaTesto(bodyToText(htmlZoho)))
}
