import { describe, expect, it } from "vitest"
import { validaFormula } from "../layout-validate"

/**
 * Le formule realmente configurate su Zoho per il modulo Clienti, estratte da
 * GET /crm/v8/settings/layouts?module=Contacts e tradotte nella sintassi
 * {Etichetta} (solo i riferimenti: operatori e struttura restano identici).
 *
 * Stanno qui come rete: la validazione e' volutamente permissiva, e una
 * stretta futura fatta senza avere queste sotto gli occhi le rifiuterebbe.
 * Quattro usano If() annidati con confronti su stringhe — esattamente il
 * caso che una whitelist aritmetica avrebbe bloccato.
 */
const FORMULE_ZOHO_CLIENTI: Array<[string, string]> = [
  ["di cui FTV", "{Tot Contratto}-{di cui CT3}"],
  ["Bonifico1", "{Fattura 1}*0.35"],
  ["Bonifico2", "{Fattura2}*0.35"],
  ["IncentivoAtteso", "{FatturaPDC}-{BonificoPDC}"],
  ["Tot Potenza DC", "{Nr. Moduli}*{Potenza Moduli (Wp)}/1000"],
  ["Tot Potenza AC (KW)", "{Nr. Inverter}*{Potenza Inverter}"],
  ["Totale Storage", "{Capacità Batterie}*{Nr. Batterie}"],
  [
    "1° Tranche",
    "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.3,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,{Importo Contrattuale}-{Sconto COMBO}-{Importo Finanziamento})))",
  ],
  [
    "2°Tranche",
    "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='50-50',0,If({Modalità di Pagamento}=='100% Finanziamento',0,0)))",
  ],
  [
    "Saldo",
    "If({Modalità di Pagamento}=='30-50-20',({Importo Contrattuale}-{Sconto COMBO})*0.2,If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,If({Modalità di Pagamento}=='100% Finanziamento',0,0)))",
  ],
  [
    "Importo Finanziamento",
    "If({Modalità di Pagamento}=='100% Finanziamento',({Importo Contrattuale}-{Sconto COMBO}),If({Modalità di Pagamento}=='Finanziamento Parziale',{Importo Contrattuale}-{Sconto COMBO}-{Bonifico Parziale},0))",
  ],
]

describe("formule reali del modulo Clienti", () => {
  it.each(FORMULE_ZOHO_CLIENTI)("%s passa la validazione", (_nome, expr) => {
    expect(validaFormula({ expr }).ok).toBe(true)
  })

  it("estrae i campi da cui dipende una formula condizionale", () => {
    const saldo = FORMULE_ZOHO_CLIENTI.find(([nome]) => nome === "Saldo")![1]
    const esito = validaFormula({ expr: saldo })
    expect(esito.ok).toBe(true)
    if (esito.ok) {
      expect(esito.riferimenti).toEqual([
        "Modalità di Pagamento",
        "Importo Contrattuale",
        "Sconto COMBO",
      ])
    }
  })

  it("conserva l'originale Zoho accanto alla traduzione", () => {
    // Zoho chiude: senza l'originale, una traduzione sbagliata non sarebbe
    // piu' verificabile contro la fonte.
    const esito = validaFormula({
      expr: "{Fattura 1}*0.35",
      origine_zoho: "${Fattura_1}*0.35",
    })
    expect(esito.ok).toBe(true)
    if (esito.ok) expect(esito.formula.origine_zoho).toBe("${Fattura_1}*0.35")
  })
})
