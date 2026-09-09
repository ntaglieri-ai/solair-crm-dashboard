import { describe, expect, it } from "vitest"
import {
  chiaveDaEtichetta,
  formulaAutoReferenziale,
  intInRange,
  isChiaveValida,
  isEtichettaValida,
  isLayoutModulo,
  isTipoValido,
  normalizzaFormato,
  validaFormula,
} from "../layout-validate"

describe("moduli e chiavi", () => {
  it("accetta solo i moduli previsti", () => {
    expect(isLayoutModulo("clienti")).toBe(true)
    expect(isLayoutModulo("lead")).toBe(true)
    expect(isLayoutModulo("installatori")).toBe(true)
    expect(isLayoutModulo("compiti")).toBe(true)
    expect(isLayoutModulo("Clienti")).toBe(false)
    expect(isLayoutModulo("utenti")).toBe(false)
    expect(isLayoutModulo(null)).toBe(false)
  })

  it("accetta chiavi minuscole con trattini", () => {
    expect(isChiaveValida("anagrafica")).toBe(true)
    expect(isChiaveValida("iter-burocratico")).toBe(true)
  })

  it("rifiuta chiavi che romperebbero un ancoraggio", () => {
    expect(isChiaveValida("Anagrafica")).toBe(false)
    expect(isChiaveValida("iter burocratico")).toBe(false)
    expect(isChiaveValida("1-anagrafica")).toBe(false)
    expect(isChiaveValida("")).toBe(false)
    expect(isChiaveValida("a".repeat(64))).toBe(false)
  })

  it("deriva la chiave da un'etichetta con accenti e spazi", () => {
    expect(chiaveDaEtichetta("Iter burocratico")).toBe("iter-burocratico")
    expect(chiaveDaEtichetta("  Attività  ")).toBe("attivita")
    expect(chiaveDaEtichetta("Pagamenti & Note Commerciali")).toBe("pagamenti-note-commerciali")
  })

  it("la chiave derivata e' sempre valida", () => {
    for (const label of ["Anagrafica", "Info Tecniche Termico", "Dati Amministrativi CT3.0"]) {
      expect(isChiaveValida(chiaveDaEtichetta(label))).toBe(true)
    }
  })
})

describe("etichette e tipi", () => {
  it("rifiuta etichette vuote o troppo lunghe", () => {
    expect(isEtichettaValida("Anagrafica")).toBe(true)
    expect(isEtichettaValida("   ")).toBe(false)
    expect(isEtichettaValida("x".repeat(121))).toBe(false)
    expect(isEtichettaValida(42)).toBe(false)
  })

  it("accetta solo tipi in catalogo, inclusi i nuovi", () => {
    expect(isTipoValido("decimal")).toBe(true)
    expect(isTipoValido("percent")).toBe(true)
    expect(isTipoValido("url")).toBe(true)
    // "formula" e' una proprieta' del campo, non un tipo.
    expect(isTipoValido("formula")).toBe(false)
    expect(isTipoValido("inventato")).toBe(false)
  })
})

describe("intInRange", () => {
  it("accetta interi nell'intervallo e rifiuta il resto", () => {
    expect(intInRange(2, 1, 4)).toBe(2)
    expect(intInRange(0, 1, 4)).toBeNull()
    expect(intInRange(2.5, 1, 4)).toBeNull()
    expect(intInRange(NaN, 1, 4)).toBeNull()
    expect(intInRange("2", 1, 4)).toBeNull()
  })
})

describe("normalizzaFormato", () => {
  it("tiene solo le chiavi previste", () => {
    const formato = normalizzaFormato({
      decimali: 2,
      valuta: "EUR",
      placeholder: "—",
      iniettata: "<script>",
    })
    expect(formato).toEqual({ decimali: 2, valuta: "EUR", placeholder: "—" })
  })

  it("scarta valori fuori formato senza fallire", () => {
    expect(normalizzaFormato({ decimali: 99, valuta: "euro" })).toEqual({})
    expect(normalizzaFormato(null)).toEqual({})
    expect(normalizzaFormato("stringa")).toEqual({})
    expect(normalizzaFormato([1, 2])).toEqual({})
  })
})

describe("validaFormula", () => {
  it("accetta un'espressione aritmetica fra campi", () => {
    const esito = validaFormula({
      expr: "{Importo Contrattuale} - {1° Tranche} - {2°Tranche}",
    })
    expect(esito.ok).toBe(true)
    if (esito.ok) {
      expect(esito.riferimenti).toEqual(["Importo Contrattuale", "1° Tranche", "2°Tranche"])
    }
  })

  it("accetta parentesi e moltiplicazioni", () => {
    const esito = validaFormula({ expr: "({Nr. Moduli} * {Potenza Moduli (Wp)}) / 1000" })
    expect(esito.ok).toBe(true)
  })

  it("conserva l'espressione Zoho originale come documentazione", () => {
    const esito = validaFormula({ expr: "{a} + {b}", origine_zoho: "${Contacts.a} + ${Contacts.b}" })
    expect(esito.ok).toBe(true)
    if (esito.ok) expect(esito.formula.origine_zoho).toBe("${Contacts.a} + ${Contacts.b}")
  })

  it("accetta funzioni: non si sa ancora cosa arrivera' da Zoho", () => {
    // La forma delle formule Zoho non e' stata ancora esportata: decidere
    // ora quali operazioni siano lecite significherebbe rifiutare al
    // salvataggio formule legittime. Le restrizioni valgono alla
    // valutazione, non all'import.
    expect(validaFormula({ expr: "SUM({a}, {b})" }).ok).toBe(true)
    expect(validaFormula({ expr: "IF({Stato} = 'Installato', {a}, 0)" }).ok).toBe(true)
    expect(validaFormula({ expr: "1 + 1" }).ok).toBe(true)
  })

  it("rifiuta delimitatori non bilanciati", () => {
    expect(validaFormula({ expr: "({a} + {b}" }).ok).toBe(false)
    expect(validaFormula({ expr: "{a}) + {b}" }).ok).toBe(false)
    expect(validaFormula({ expr: "{a + {b}" }).ok).toBe(false)
  })

  it("rifiuta riferimenti vuoti ed espressioni assenti", () => {
    expect(validaFormula({ expr: "{a} + {}" }).ok).toBe(false)
    expect(validaFormula({ expr: "   " }).ok).toBe(false)
    expect(validaFormula(null).ok).toBe(false)
  })

  it("segnala una formula che dipende da se stessa senza rifiutarla", () => {
    const esito = validaFormula({ expr: "{Saldo} + {Importi extra}" })
    // Salvabile comunque: se e' cosi' che arriva da Zoho va importata, e
    // sistemata dopo con il dato sotto gli occhi.
    expect(esito.ok).toBe(true)
    if (esito.ok) {
      expect(formulaAutoReferenziale("Saldo", esito.riferimenti)).toBe(true)
      expect(formulaAutoReferenziale("Totale", esito.riferimenti)).toBe(false)
    }
  })
})
