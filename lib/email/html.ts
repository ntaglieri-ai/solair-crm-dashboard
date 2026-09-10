export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function textToSafeHtml(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br/>")
}

/**
 * Riconosce un corpo gia' in HTML da uno scritto a mano.
 *
 * I modelli importati da Zoho sono pagine HTML complete; un messaggio
 * digitato nella finestra di invio e' testo semplice. Vanno spediti in modo
 * diverso, e confonderli si vede subito: un modello passato per
 * textToSafeHtml arriva al destinatario con i tag in chiaro.
 */
export function isHtmlBody(value: string): boolean {
  return /<\s*(html|body|table|div|p|br|span|img)\b/i.test(value)
}

/**
 * La parte HTML di un'email, qualunque cosa sia stata scritta.
 *
 * Un corpo gia' HTML si spedisce com'e'; uno scritto a mano viene
 * neutralizzato e mandato a capo, cosi' un messaggio che contiene "<" non
 * diventa markup per sbaglio.
 */
export function bodyToHtml(value: string): string {
  return isHtmlBody(value) ? value : textToSafeHtml(value)
}

/**
 * La parte testuale di un'email.
 *
 * I programmi di posta che non mostrano HTML leggono questa. Da un corpo
 * HTML si ricava togliendo i tag: meglio un testo semplificato che una
 * pagina di markup illeggibile.
 */
export function bodyToText(value: string): string {
  if (!isHtmlBody(value)) return value
  return value
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
