import { describe, expect, it } from "vitest"

import {
  normalizzaValore,
  risolviCampoAI,
  smistaCampi,
  valorePieno,
} from "@/lib/solair-ai/campi"
import type { CampoProposto } from "@/lib/solair-ai/tipi"

/**
 * Le due regole coperte qui sbagliano in silenzio, ed e' per questo che sono
 * testate: smistaCampi decide se un valore letto da un documento finisce
 * SOPRA un dato esistente o in coda di revisione, e normalizzaValore decide
 * che cosa arriva davvero nella colonna. Un errore in nessuna delle due da'
 * un messaggio d'errore — da' un CRM con dentro il dato sbagliato.
 */

function proposto(campo: string, valore: string): CampoProposto {
  return { campo, etichetta: campo, valore, fonte: "Solair/AI/Lead/doc.pdf" }
}

describe("smistaCampi", () => {
  it("scrive nei campi vuoti e manda in revisione quelli gia' pieni", () => {
    const esito = smistaCampi(
      "lead",
      [proposto("email", "mario@example.com"), proposto("telefono", "3331234567")],
      { email: null, telefono: "3339999999" },
    )

    expect(esito.daScrivere.map((voce) => voce.campo.campo)).toEqual(["email"])
    expect(esito.inRevisione.map((voce) => voce.campo.campo)).toEqual(["telefono"])
    expect(esito.inRevisione[0].valoreAttuale).toBe("3339999999")
  })

  it("tratta la stringa di soli spazi come campo vuoto", () => {
    const esito = smistaCampi("lead", [proposto("citta", "Palermo")], { citta: "   " })
    expect(esito.daScrivere).toHaveLength(1)
    expect(esito.inRevisione).toHaveLength(0)
  })

  it("non apre una revisione quando il valore proposto e' gia' quello presente", () => {
    const esito = smistaCampi("lead", [proposto("citta", "palermo")], { citta: "Palermo" })
    expect(esito.daScrivere).toHaveLength(0)
    expect(esito.inRevisione).toHaveLength(0)
    expect(esito.invariati).toHaveLength(1)
  })

  it("scarta i campi fuori catalogo invece di scriverli", () => {
    // La whitelist e' l'unica difesa fra una proposta che arriva dal client e
    // una UPDATE: un campo inventato non deve arrivare alla query.
    const esito = smistaCampi("lead", [proposto("iban", "IT60X05428")], {})
    expect(esito.daScrivere).toHaveLength(0)
    expect(esito.inRevisione).toHaveLength(0)
  })

  it("accetta sia la colonna sia l'etichetta CRM come nome del campo", () => {
    const perColonna = smistaCampi("lead", [proposto("modello_pannello", "Trina 450")], {})
    const perEtichetta = smistaCampi("lead", [proposto("Modello pannello", "Trina 450")], {})

    expect(perColonna.daScrivere[0]?.campo.campo).toBe("modello_pannello")
    expect(perEtichetta.daScrivere[0]?.campo.campo).toBe("modello_pannello")
  })

  it("scarta il valore che non si lascia interpretare, senza scrivere niente", () => {
    const esito = smistaCampi("lead", [proposto("kwp", "da definire")], { kwp: null })
    expect(esito.daScrivere).toHaveLength(0)
    expect(esito.invariati).toHaveLength(1)
  })

  it("considera vuoto un booleano false, cosi' un 'si' letto dal documento passa", () => {
    // false e' il default della colonna: trattarlo come "gia' pieno" avrebbe
    // mandato in revisione ogni booleano su un record mai toccato.
    const esito = smistaCampi("lead", [proposto("wallbox_richiesto", "si")], {
      wallbox_richiesto: false,
    })
    expect(esito.daScrivere).toHaveLength(1)
    expect(esito.daScrivere[0].valore).toBe(true)
  })
})

describe("normalizzaValore", () => {
  const kwp = risolviCampoAI("lead", "kwp")!
  const data = risolviCampoAI("lead", "data_sopralluogo")!
  const wallbox = risolviCampoAI("lead", "wallbox_richiesto")!

  it("legge i numeri all'italiana: virgola decimale e punto delle migliaia", () => {
    expect(normalizzaValore(kwp, "6,5")).toBe(6.5)
    expect(normalizzaValore(kwp, "1.234,50")).toBe(1234.5)
    expect(normalizzaValore(kwp, "9 kWp")).toBe(9)
  })

  it("legge gg/mm/aaaa come data italiana e non americana", () => {
    // Date.parse su "05/03/2026" darebbe il 3 maggio: qui deve essere il 5 marzo.
    expect(normalizzaValore(data, "05/03/2026")).toBe("2026-03-05T00:00:00.000Z")
  })

  it("legge le forme in cui un documento scrive un si o un no", () => {
    expect(normalizzaValore(wallbox, "Si")).toBe(true)
    expect(normalizzaValore(wallbox, "NO")).toBe(false)
    expect(normalizzaValore(wallbox, "forse")).toBeUndefined()
  })

  it("restituisce undefined su un valore vuoto o non numerico", () => {
    expect(normalizzaValore(kwp, "   ")).toBeUndefined()
    expect(normalizzaValore(kwp, "non indicato")).toBeUndefined()
  })
})

describe("valorePieno", () => {
  it("distingue il vuoto reale dal valore presente", () => {
    expect(valorePieno(null)).toBe(false)
    expect(valorePieno(undefined)).toBe(false)
    expect(valorePieno("")).toBe(false)
    expect(valorePieno("  ")).toBe(false)
    expect(valorePieno(false)).toBe(false)
    expect(valorePieno(0)).toBe(true)
    expect(valorePieno("Palermo")).toBe(true)
    expect(valorePieno(true)).toBe(true)
  })
})
