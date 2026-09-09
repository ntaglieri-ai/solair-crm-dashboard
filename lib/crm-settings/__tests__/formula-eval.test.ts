import { describe, expect, it } from "vitest"
import { dipendenzeFormula, valutaFormula, type ValoreFormula } from "../formula-eval"

function valori(record: Record<string, ValoreFormula>) {
  return new Map(Object.entries(record))
}

/** Le formule reali del modulo Clienti, come tradotte dall'export Zoho. */
const SALDO =
  "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.2,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,0)))"

const PRIMA_TRANCHE =
  "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.3,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,{Importo Contrattuale}-{Sconto COMBO}-{Importo Finanziamento})))"

const IMPORTO_FINANZIAMENTO =
  "If({Modalità di Pagamento}=='100% Finanziamento',({Importo Contrattuale}-{Sconto COMBO}),If({Modalità di Pagamento}=='Finanziamento Parziale',{Importo Contrattuale}-{Sconto COMBO}-{Bonifico Parziale},0))"

describe("aritmetica", () => {
  it("somma, sottrae, moltiplica e divide", () => {
    const v = valori({ a: 10, b: 4 })
    expect(valutaFormula("{a}+{b}", v)).toEqual({ ok: true, valore: 14 })
    expect(valutaFormula("{a}-{b}", v)).toEqual({ ok: true, valore: 6 })
    expect(valutaFormula("{a}*{b}", v)).toEqual({ ok: true, valore: 40 })
    expect(valutaFormula("{a}/{b}", v)).toEqual({ ok: true, valore: 2.5 })
  })

  it("rispetta la precedenza degli operatori", () => {
    // Senza precedenza corretta verrebbe 18 invece di 14.
    expect(valutaFormula("2+3*4", valori({}))).toEqual({ ok: true, valore: 14 })
    expect(valutaFormula("(2+3)*4", valori({}))).toEqual({ ok: true, valore: 20 })
  })

  it("gestisce il meno unario", () => {
    expect(valutaFormula("-{a}+5", valori({ a: 3 }))).toEqual({ ok: true, valore: 2 })
  })

  it("tratta un campo vuoto o assente come zero, come fa Zoho", () => {
    // Un importo non compilato non deve azzerare la formula ne' produrre NaN.
    expect(valutaFormula("{a}+{b}", valori({ a: 10, b: null }))).toEqual({ ok: true, valore: 10 })
    expect(valutaFormula("{a}+{mai visto}", valori({ a: 10 }))).toEqual({ ok: true, valore: 10 })
    expect(valutaFormula("{a}+{b}", valori({ a: 10, b: "" }))).toEqual({ ok: true, valore: 10 })
  })

  it("non produce Infinity dividendo per zero", () => {
    expect(valutaFormula("{a}/{b}", valori({ a: 10, b: 0 }))).toEqual({ ok: true, valore: null })
  })
})

describe("Tot Potenza DC", () => {
  const expr = "{Nr. Moduli}*{Potenza Moduli (Wp)}/1000"

  it("calcola i kWp dai moduli", () => {
    // Il caso reale visto sulla scheda di Mario Spadaro: 27 moduli da 455 Wp.
    const esito = valutaFormula(expr, valori({ "Nr. Moduli": 27, "Potenza Moduli (Wp)": 455 }))
    expect(esito.ok).toBe(true)
    if (esito.ok) expect(esito.valore).toBeCloseTo(12.285, 3)
  })

  it("torna zero quando i moduli non sono ancora stati indicati", () => {
    expect(valutaFormula(expr, valori({}))).toEqual({ ok: true, valore: 0 })
  })
})

describe("formule condizionali sulla modalita' di pagamento", () => {
  const base = { "Importo Contrattuale": 20000, "Sconto COMBO": 0, "Importo Finanziamento": 0 }

  it("30-50-20 ripartisce 30/50/20", () => {
    const v = valori({ ...base, "Modalità di Pagamento": "30-50-20" })
    expect(valutaFormula(PRIMA_TRANCHE, v)).toEqual({ ok: true, valore: 6000 })
    expect(valutaFormula(SALDO, v)).toEqual({ ok: true, valore: 4000 })
  })

  it("50-50 mette meta' sulla prima tranche e meta' sul saldo", () => {
    const v = valori({ ...base, "Modalità di Pagamento": "50-50" })
    expect(valutaFormula(PRIMA_TRANCHE, v)).toEqual({ ok: true, valore: 10000 })
    expect(valutaFormula(SALDO, v)).toEqual({ ok: true, valore: 10000 })
  })

  it("100% Finanziamento azzera tranche e saldo", () => {
    const v = valori({ ...base, "Modalità di Pagamento": "100% Finanziamento" })
    expect(valutaFormula(PRIMA_TRANCHE, v)).toEqual({ ok: true, valore: 0 })
    expect(valutaFormula(SALDO, v)).toEqual({ ok: true, valore: 0 })
    expect(valutaFormula(IMPORTO_FINANZIAMENTO, v)).toEqual({ ok: true, valore: 20000 })
  })

  it("Finanziamento Parziale sottrae il bonifico gia' versato", () => {
    const v = valori({ ...base, "Modalità di Pagamento": "Finanziamento Parziale", "Bonifico Parziale": 5000 })
    expect(valutaFormula(IMPORTO_FINANZIAMENTO, v)).toEqual({ ok: true, valore: 15000 })
  })

  it("una modalita' non prevista dalle formule finisce nel ramo finale", () => {
    // "10-20-50-20" e "20-60-20" esistono nel picklist Zoho ma non nelle
    // formule: la prima tranche prende tutto e il saldo resta zero. E' il
    // comportamento di Zoho, replicato senza correzioni.
    const v = valori({ ...base, "Modalità di Pagamento": "10-20-50-20" })
    expect(valutaFormula(PRIMA_TRANCHE, v)).toEqual({ ok: true, valore: 20000 })
    expect(valutaFormula(SALDO, v)).toEqual({ ok: true, valore: 0 })
  })

  it("tiene conto dello sconto COMBO", () => {
    const v = valori({ ...base, "Sconto COMBO": 2000, "Modalità di Pagamento": "50-50" })
    expect(valutaFormula(PRIMA_TRANCHE, v)).toEqual({ ok: true, valore: 9000 })
  })

  it("confronta le stringhe senza convertirle in numero", () => {
    // '30-50-20' letto come numero darebbe NaN e il confronto fallirebbe.
    const v = valori({ ...base, "Modalità di Pagamento": "30-50-20" })
    expect(valutaFormula(SALDO, v)).toEqual({ ok: true, valore: 4000 })
  })
})

describe("sicurezza e robustezza", () => {
  it("non esegue codice: le espressioni sono interpretate, non valutate", () => {
    // Se ci fosse un eval() dietro, questa cambierebbe stato invece di
    // essere respinta.
    const esito = valutaFormula("process.exit(1)", valori({}))
    expect(esito.ok).toBe(false)
  })

  it("rifiuta funzioni diverse da If", () => {
    const esito = valutaFormula("SUM({a},{b})", valori({ a: 1, b: 2 }))
    expect(esito.ok).toBe(false)
    if (!esito.ok) expect(esito.errore).toContain("SUM")
  })

  it("segnala parentesi e delimitatori non chiusi senza lanciare", () => {
    expect(valutaFormula("({a}+{b}", valori({ a: 1, b: 2 })).ok).toBe(false)
    expect(valutaFormula("{a", valori({})).ok).toBe(false)
    expect(valutaFormula("'testo", valori({})).ok).toBe(false)
  })

  it("segnala espressioni vuote o incomplete", () => {
    expect(valutaFormula("", valori({})).ok).toBe(false)
    expect(valutaFormula("{a} +", valori({ a: 1 })).ok).toBe(false)
    expect(valutaFormula("{a} {b}", valori({ a: 1, b: 2 })).ok).toBe(false)
  })
})

describe("dipendenzeFormula", () => {
  it("elenca i campi usati, senza ripetizioni", () => {
    expect(dipendenzeFormula(SALDO)).toEqual([
      "Modalità di Pagamento",
      "Importo Contrattuale",
      "Sconto COMBO",
    ])
  })

  it("torna vuoto su un'espressione malformata invece di lanciare", () => {
    expect(dipendenzeFormula("{a")).toEqual([])
  })
})
