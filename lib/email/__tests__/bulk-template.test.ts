import { describe, expect, it } from "vitest"
import { renderTemplate } from "../bulk-template"

/**
 * I segnaposto dei modelli e-mail.
 *
 * I quattro di base ({nome}, {cognome}, {email}, {telefono}) esistono da
 * sempre. Quelli sui campi del record sono arrivati con i modelli importati
 * da Zoho: il modello di Assistenza da solo ne usa diciotto, e senza
 * arriverebbe al cliente con i segnaposto in chiaro.
 */

const BASE = {
  nome: "Mario",
  cognome: "Rossi",
  email: "mario@example.test",
  telefono: "+393401234567",
}

describe("renderTemplate", () => {
  it("sostituisce i segnaposto di base", () => {
    expect(renderTemplate("Gentile {nome} {cognome},", BASE)).toBe("Gentile Mario Rossi,")
  })

  it("non distingue maiuscole nei segnaposto di base", () => {
    expect(renderTemplate("Ciao {Nome}", BASE)).toBe("Ciao Mario")
  })

  it("lascia intatto un segnaposto che non conosce", () => {
    // Meglio un token visibile da correggere che un buco silenzioso nel
    // testo inviato al cliente.
    expect(renderTemplate("Ciao {sconosciuto}", BASE)).toBe("Ciao {sconosciuto}")
  })

  it("sostituisce i campi del record", () => {
    const campi = { "Nr. Moduli": 27, "Capacità Batterie": 23 }
    expect(renderTemplate("Impianto da {Nr. Moduli} moduli", BASE, campi)).toBe(
      "Impianto da 27 moduli",
    )
  })

  it("trova il campo anche con maiuscole diverse", () => {
    // I nomi dei campi vengono scritti a mano nei modelli.
    const campi = { "COD- MODULI": "ABC123" }
    expect(renderTemplate("Codice {cod- moduli}", BASE, campi)).toBe("Codice ABC123")
  })

  it("un campo vuoto diventa stringa vuota, non 'null'", () => {
    const campi = { "Data installazione ultimata": null }
    expect(renderTemplate("Il {Data installazione ultimata} lavori", BASE, campi)).toBe(
      "Il  lavori",
    )
  })

  it("mostra i booleani in italiano", () => {
    expect(renderTemplate("Wallbox: {Wallbox}", BASE, { Wallbox: true })).toBe("Wallbox: Sì")
  })

  it("non rovina le regole CSS dentro il corpo HTML", () => {
    // I modelli importati sono HTML completo, con fogli di stile: le graffe
    // che non corrispondono a un campo devono restare com'erano.
    const html = "<style>.riga { margin: 0; padding: 4px }</style><p>Ciao {nome}</p>"
    expect(renderTemplate(html, BASE)).toBe(
      "<style>.riga { margin: 0; padding: 4px }</style><p>Ciao Mario</p>",
    )
  })

  it("i campi non prevalgono sui segnaposto di base", () => {
    // Se un record avesse un campo chiamato "nome", il segnaposto di base
    // deve continuare a valere: e' quello che i modelli usano da sempre.
    expect(renderTemplate("Ciao {nome}", BASE, { nome: "Sbagliato" })).toBe("Ciao Mario")
  })
})
