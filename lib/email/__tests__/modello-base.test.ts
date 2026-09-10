import { describe, expect, it } from "vitest"
import { AZIENDA, convertiDaZoho, modelloBase, paragrafiDaTesto } from "../modello-base"
import { bodyToText, isHtmlBody } from "../html"

/**
 * L'involucro delle email Solair.
 *
 * I controlli qui sotto guardano le cose che si rompono davvero nelle
 * caselle di posta: la larghezza fissa, gli stili in linea, i dati
 * aziendali nel piede, e il fatto che i segnaposto arrivino intatti fino
 * all'invio.
 */

describe("paragrafiDaTesto", () => {
  it("separa i paragrafi sulle righe vuote", () => {
    const html = paragrafiDaTesto("Gentile cliente,\n\nla informiamo che…")
    expect(html.match(/<p /g)).toHaveLength(2)
  })

  it("neutralizza i simboli del testo", () => {
    // Un preventivo "< 1000" non deve diventare markup e sparire.
    expect(paragrafiDaTesto("Costo < 1000")).toContain("&lt;")
  })

  it("scarta le righe vuote in eccesso", () => {
    expect(paragrafiDaTesto("Uno\n\n\n\nDue").match(/<p /g)).toHaveLength(2)
  })
})

describe("modelloBase", () => {
  it("produce un documento HTML completo", () => {
    const html = modelloBase("Ciao")
    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(isHtmlBody(html)).toBe(true)
  })

  it("usa una larghezza fissa di 600px", () => {
    // I programmi di posta ignorano buona parte del CSS moderno: la
    // larghezza va dichiarata sulla tabella, non lasciata al foglio di stile.
    expect(modelloBase("Ciao")).toContain('width="600"')
  })

  it("mette i dati aziendali nel piede", () => {
    const html = modelloBase("Ciao")
    expect(html).toContain(AZIENDA.piva)
    expect(html).toContain(AZIENDA.email)
    expect(html).toContain(AZIENDA.nome)
  })

  it("usa un indirizzo pubblico per il logo", () => {
    // Un file del progetto non e' raggiungibile dalla casella del
    // destinatario: l'immagine arriverebbe rotta.
    expect(modelloBase("Ciao")).toContain("https://")
    expect(modelloBase("Ciao")).not.toContain('src="/')
  })

  it("lascia intatti i segnaposto", () => {
    // Vengono sostituiti al momento dell'invio: se l'involucro li
    // trasformasse, arriverebbero in chiaro al cliente.
    expect(modelloBase("Gentile {nome} {cognome},")).toContain("{nome}")
  })

  it("accetta anche HTML già pronto senza spezzarlo in paragrafi", () => {
    expect(modelloBase("<p>Già pronto</p>")).toContain("<p>Già pronto</p>")
  })
})

describe("convertiDaZoho", () => {
  const zoho =
    "<html><head><style>body{margin:0}</style></head><body>" +
    "<table><tr><td><p>Gentile {nome},</p><p>il sopralluogo è confermato.</p></td></tr></table>" +
    "</body></html>"

  it("tiene il testo e butta l'impaginazione originale", () => {
    const html = convertiDaZoho(zoho)
    expect(bodyToText(html)).toContain("Gentile {nome},")
    expect(bodyToText(html)).toContain("il sopralluogo è confermato.")
    expect(html).not.toContain("body{margin:0}")
  })

  it("il risultato è molto più corto dell'originale", () => {
    // E' il punto dell'operazione: da trentamila caratteri di markup
    // generato a un documento leggibile e modificabile.
    const lungo = "<html><head><style>" + "a{b:c}".repeat(2000) + "</style></head><body><p>Ciao</p></body></html>"
    expect(convertiDaZoho(lungo).length).toBeLessThan(lungo.length / 2)
  })

  it("conserva i dati aziendali nel piede", () => {
    expect(convertiDaZoho(zoho)).toContain(AZIENDA.piva)
  })
})
