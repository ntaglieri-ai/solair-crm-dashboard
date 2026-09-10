import { describe, expect, it } from "vitest"
import { bodyToHtml, bodyToText, isHtmlBody, textToSafeHtml } from "../html"

/**
 * Come viene spedito il corpo di un'email.
 *
 * I modelli importati da Zoho sono pagine HTML complete; un messaggio
 * digitato nella finestra di invio e' testo semplice. Confonderli si vede
 * subito nella casella del destinatario: un modello trattato come testo
 * arriva con i tag in chiaro.
 */

describe("isHtmlBody", () => {
  it("riconosce un modello HTML", () => {
    expect(isHtmlBody("<html><body><p>Ciao</p></body></html>")).toBe(true)
    expect(isHtmlBody('<table class="x"><tr><td>Ciao</td></tr></table>')).toBe(true)
  })

  it("non scambia per HTML un messaggio scritto a mano", () => {
    expect(isHtmlBody("Gentile cliente,\n\nla informiamo che…")).toBe(false)
    expect(isHtmlBody("Il preventivo è < 1000 euro")).toBe(false)
  })
})

describe("bodyToHtml", () => {
  it("spedisce un modello HTML così com'è", () => {
    const modello = "<html><body><p>Gentile {nome}</p></body></html>"
    expect(bodyToHtml(modello)).toBe(modello)
  })

  it("converte il testo scritto a mano mandandolo a capo", () => {
    expect(bodyToHtml("Ciao\nMario")).toBe("Ciao<br/>Mario")
  })

  it("neutralizza i simboli di un testo scritto a mano", () => {
    expect(bodyToHtml("Costo < 1000")).toBe(textToSafeHtml("Costo < 1000"))
  })
})

describe("bodyToText", () => {
  it("lascia intatto un messaggio scritto a mano", () => {
    expect(bodyToText("Gentile cliente,\n\ngrazie.")).toBe("Gentile cliente,\n\ngrazie.")
  })

  it("ricava un testo leggibile da un modello HTML", () => {
    const html =
      "<html><head><style>.x{color:red}</style></head><body><p>Ciao</p><p>Mario</p></body></html>"
    expect(bodyToText(html)).toBe("Ciao\nMario")
  })

  it("toglie fogli di stile e script dal testo", () => {
    const html =
      "<body><style>p{margin:0}</style><script>alert(1)</script><p>Solo questo</p></body>"
    expect(bodyToText(html)).toBe("Solo questo")
  })

  it("traduce le entità più comuni", () => {
    expect(bodyToText("<p>Costo &lt; 1000 &amp; oltre</p>")).toBe("Costo < 1000 & oltre")
  })
})
