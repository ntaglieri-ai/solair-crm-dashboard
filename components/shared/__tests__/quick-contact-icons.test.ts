import { describe, expect, it } from "vitest"
import { telHref } from "../quick-contact-icons"

/**
 * Il collegamento "tel:" costruito dai numeri in anagrafica.
 *
 * I casi qui sotto vengono dai dati veri: numeri scritti a mano da persone
 * diverse in anni diversi, con prefissi fra parentesi, spazi, e in piu' di
 * un caso due numeri nello stesso campo.
 */
describe("telHref", () => {
  it("toglie spazi e trattini tenendo le cifre", () => {
    expect(telHref("347 280 76 82")).toBe("3472807682")
    expect(telHref("347-280-7682")).toBe("3472807682")
  })

  it("conserva il prefisso internazionale", () => {
    // Senza il "+", il centralino legge il numero come nazionale e chiama
    // un'utenza diversa.
    expect(telHref("+393427807682")).toBe("+393427807682")
    expect(telHref("(+39) 342 780 7682")).toBe("+393427807682")
  })

  it("prende il primo quando nel campo ci sono piu' numeri", () => {
    // Caso reale: il lead Youssef Nabil aveva due numeri nello stesso campo,
    // e la vecchia versione li fondeva in "+393427807682393387759140" — venti
    // cifre, un'utenza che non esiste.
    expect(telHref("+393427807682 / +393387759140")).toBe("+393427807682")
    expect(telHref("3427807682, 3387759140")).toBe("3427807682")
    expect(telHref("3427807682; 3387759140")).toBe("3427807682")
    expect(telHref("3427807682\n3387759140")).toBe("3427807682")
  })

  it("taglia anche quando i due numeri sono incollati senza separatore", () => {
    // Com'e' salvato sul lead Youssef Nabil: "+39342…+39338…", nessuna
    // barra ne' virgola, solo il "+" del secondo numero.
    expect(telHref("+393427807682+393387759140")).toBe("+393427807682")
  })

  it("torna vuoto su un campo senza cifre", () => {
    expect(telHref("")).toBe("")
    expect(telHref("—")).toBe("")
  })
})
