import { describe, expect, it } from "vitest"
import { valutaFormula, type ValoreFormula } from "../formula-eval"

/**
 * Confronto con i numeri realmente calcolati da Zoho.
 *
 * I valori attesi non sono inventati: vengono dalla stampa della scheda del
 * cliente Mario Spadaro esportata da Zoho l'8 settembre 2026, dove compaiono
 * sia i campi di partenza sia il risultato che Zoho ha prodotto.
 *
 * E' la verifica piu' forte disponibile sulla traduzione delle formule: se
 * il valutatore desse numeri diversi da questi, la migrazione porterebbe
 * importi sbagliati sulle pratiche vere. Quando Zoho sara' spento questi casi
 * restano l'unica testimonianza del comportamento originale.
 */

function valori(record: Record<string, ValoreFormula>) {
  return new Map(Object.entries(record))
}

function calcola(expr: string, record: Record<string, ValoreFormula>): number {
  const esito = valutaFormula(expr, valori(record))
  if (!esito.ok) throw new Error(esito.errore)
  return Number(esito.valore)
}

describe("scheda Mario Spadaro, valori calcolati da Zoho", () => {
  // Dati dell'impianto come risultano sulla scheda.
  const impianto = {
    "Nr. Moduli": 27,
    "Potenza Moduli (Wp)": 455,
    "Nr. Inverter": 2,
    "Potenza Inverter": 5,
    "Nr. Batterie": 1,
    "Capacità Batterie": 23,
  }

  it("Tot Potenza DC: Zoho mostra 12,29", () => {
    const nostro = calcola("{Nr. Moduli}*{Potenza Moduli (Wp)}/1000", impianto)
    expect(Number(nostro.toFixed(2))).toBe(12.29)
  })

  it("Tot Potenza AC (KW): Zoho mostra 10", () => {
    expect(calcola("{Nr. Inverter}*{Potenza Inverter}", impianto)).toBe(10)
  })

  it("Totale Storage: Zoho mostra 23", () => {
    expect(calcola("{Capacità Batterie}*{Nr. Batterie}", impianto)).toBe(23)
  })

  // Parte economica: contratto da 19.790 € con modalita' 50-50.
  const economico = {
    "Importo Contrattuale": 19790,
    "Sconto COMBO": null,
    "Importo Finanziamento": 0,
    "Modalità di Pagamento": "50-50",
  }

  it("1° Tranche: Zoho mostra 9.895", () => {
    const expr =
      "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.3,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,{Importo Contrattuale}-{Sconto COMBO}-{Importo Finanziamento})))"
    expect(calcola(expr, economico)).toBe(9895)
  })

  it("2°Tranche: Zoho mostra 0", () => {
    const expr =
      "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='50-50',0,If({Modalità di Pagamento}=='100% Finanziamento',0,0)))"
    expect(calcola(expr, economico)).toBe(0)
  })

  it("Saldo: Zoho mostra 9.895", () => {
    const expr =
      "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.2,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,0)))"
    expect(calcola(expr, economico)).toBe(9895)
  })

  it("Importo Finanziamento: Zoho mostra 0", () => {
    const expr =
      "If({Modalità di Pagamento}=='100% Finanziamento',({Importo Contrattuale}-{Sconto COMBO}),If({Modalità di Pagamento}=='Finanziamento Parziale',{Importo Contrattuale}-{Sconto COMBO}-{Bonifico Parziale},0))"
    expect(calcola(expr, economico)).toBe(0)
  })

  it("lo Sconto COMBO vuoto non azzera gli importi", () => {
    // Sulla scheda lo sconto e' vuoto: se un campo non compilato non valesse
    // zero, la prima tranche verrebbe NaN invece di 9.895.
    expect(economico["Sconto COMBO"]).toBeNull()
    expect(calcola("{Importo Contrattuale}-{Sconto COMBO}", economico)).toBe(19790)
  })
})
