import { describe, expect, it } from "vitest"
import { alternaValoreMultiplo, unisciValoriMultipli, valoriMultipli } from "../valori-multipli"

describe("valori multipli", () => {
  it("separa, pulisce e toglie i doppioni", () => {
    expect(valoriMultipli("Installato;Necessario sopralluogo/intervento")).toEqual([
      "Installato",
      "Necessario sopralluogo/intervento",
    ])
    expect(valoriMultipli(" A ; B;;A ")).toEqual(["A", "B"])
    expect(valoriMultipli(null)).toEqual([])
    expect(valoriMultipli(["A", " B "])).toEqual(["A", "B"])
  })

  it("unisce nel formato Zoho, senza spazi", () => {
    expect(unisciValoriMultipli(["A", "B"])).toBe("A;B")
    expect(unisciValoriMultipli([])).toBe("")
  })

  it("aggiunge o toglie un valore", () => {
    expect(alternaValoreMultiplo("Installato", "Logistica")).toBe("Installato;Logistica")
    expect(alternaValoreMultiplo("Installato;Logistica", "Installato")).toBe("Logistica")
    expect(alternaValoreMultiplo("Logistica", "Logistica")).toBe("")
    expect(alternaValoreMultiplo(null, "Logistica")).toBe("Logistica")
  })
})
