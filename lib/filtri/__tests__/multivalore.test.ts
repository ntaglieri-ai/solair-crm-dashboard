import { describe, expect, it } from "vitest"
import { contieneUnoDi, nonContieneNessunoDi, regexElemento } from "../multivalore"
import { traduciAlbero } from "../traduci"
import type { CampoFiltrabile, Gruppo } from "../albero"

function riconosce(valore: string, cella: string): boolean {
  // Le classi POSIX non esistono in JS: [[:space:]] diventa \s solo per il test.
  return new RegExp(regexElemento(valore).replaceAll("[[:space:]]", "\\s")).test(cella)
}

describe("regexElemento", () => {
  it("riconosce il valore come elemento, non come sottostringa", () => {
    expect(riconosce("Installato", "Installato")).toBe(true)
    expect(riconosce("Installato", "Installato;Necessario sopralluogo/intervento")).toBe(true)
    expect(riconosce("Installato", "Da installare;Installato")).toBe(true)
    expect(riconosce("Installato", "Da installare; Installato ;Logistica")).toBe(true)
    expect(riconosce("Installato", "Non Installato")).toBe(false)
    expect(riconosce("Installato", "Installato parzialmente;Logistica")).toBe(false)
    expect(riconosce("Logistica", "Da installare;Logistica")).toBe(true)
  })

  it("tratta i caratteri speciali come letterali", () => {
    expect(regexElemento("Rate (12)")).toBe("(^|;)[[:space:]]*Rate [(]12[)][[:space:]]*(;|$)")
    expect(riconosce("DETR. FISC.", "CTR OLD;DETR. FISC.")).toBe(true)
    expect(riconosce("DETR. FISC.", "CTR OLD;DETRA FISCA")).toBe(false)
    expect(regexElemento("a]b")).not.toContain("\\")
  })
})

describe("condizioni PostgREST", () => {
  it("almeno uno dei valori", () => {
    expect(contieneUnoDi("stato", ["Installato"])).toBe(
      'stato.match."(^|;)[[:space:]]*Installato[[:space:]]*(;|$)"',
    )
    expect(contieneUnoDi("stato", ["A", "B"])).toMatch(/^or\(stato\.match\."[^"]*A[^"]*",stato\.match\."[^"]*B[^"]*"\)$/)
    expect(contieneUnoDi("stato", [])).toBeNull()
  })

  it("nessuno dei valori", () => {
    expect(nonContieneNessunoDi("stato", ["A", "B"])).toMatch(/^and\(stato\.not\.match\..*,stato\.not\.match\..*\)$/)
  })
})

describe("traduciAlbero con colonne multiple", () => {
  const catalogo: CampoFiltrabile[] = [
    { chiave: "Stato", etichetta: "Stato", tipo: "elenco", opzioni: ["Installato", "Logistica"] },
    { chiave: "Sede", etichetta: "Sede", tipo: "elenco", opzioni: ["Catania", "Palermo"] },
  ]
  const colonne = { Stato: "stato", Sede: "sede" }
  const albero = (campo: string, operatore: "uno_di" | "nessuno_di", valori: string[]): Gruppo => ({
    tipo: "gruppo",
    connettore: "e",
    nodi: [{ tipo: "condizione", campo, operatore, valori }],
  })

  it("uno_di sulla colonna multipla confronta i singoli valori", () => {
    const esito = traduciAlbero(albero("Stato", "uno_di", ["Installato", "Logistica"]), catalogo, colonne, new Set(["stato"]))
    expect(esito.ok && esito.espressione).toBe(contieneUnoDi("stato", ["Installato", "Logistica"]))
  })

  it("nessuno_di sulla colonna multipla", () => {
    const esito = traduciAlbero(albero("Stato", "nessuno_di", ["Installato"]), catalogo, colonne, new Set(["stato"]))
    expect(esito.ok && esito.espressione).toBe(nonContieneNessunoDi("stato", ["Installato"]))
  })

  it("le colonne a valore singolo restano con in", () => {
    const esito = traduciAlbero(albero("Sede", "uno_di", ["Catania"]), catalogo, colonne, new Set(["stato"]))
    expect(esito.ok && esito.espressione).toBe('sede.in.("Catania")')
  })
})
