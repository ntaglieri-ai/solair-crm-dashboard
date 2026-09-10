import { describe, expect, it } from "vitest"
import { alberoDaPannello } from "../da-pannello"
import { validaAlbero, type CampoFiltrabile } from "../albero"
import type { AdvancedFilterState } from "@/lib/leads/advanced-filter-logic"

const CATALOGO: CampoFiltrabile[] = [
  { chiave: "Nome Lead", etichetta: "Nome", tipo: "testo" },
  { chiave: "Stato Lead", etichetta: "Stato", tipo: "elenco" },
  { chiave: "Valutazione", etichetta: "Valutazione", tipo: "numero" },
  { chiave: "Ora creazione", etichetta: "Creato", tipo: "data" },
  { chiave: "Wallbox richiesto", etichetta: "Wallbox", tipo: "booleano" },
]

function stato(fields: AdvancedFilterState["fields"]): AdvancedFilterState {
  return {
    quick: { badgeAttivita: false, badgeNota: false, nonToccati: false, toccati: false },
    fields,
  }
}

describe("alberoDaPannello", () => {
  it("converte il testo in 'contiene'", () => {
    const albero = alberoDaPannello(
      stato({ "Nome Lead": { type: "text", contains: "rossi" } }),
      CATALOGO,
    )
    expect(albero.nodi).toEqual([
      { tipo: "condizione", campo: "Nome Lead", operatore: "contiene", valori: ["rossi"] },
    ])
  })

  it("converte piu' valori selezionati in un 'uno di'", () => {
    // Selezionare due stati nel pannello e' gia' un "oppure": non deve
    // diventare un gruppo con due condizioni.
    const albero = alberoDaPannello(
      stato({ "Stato Lead": { type: "enum", selected: ["Perso", "Contattato"] } }),
      CATALOGO,
    )
    expect(albero.nodi).toHaveLength(1)
    expect(albero.nodi[0]).toMatchObject({ operatore: "uno_di", valori: ["Perso", "Contattato"] })
  })

  it("converte il sì/no e ignora 'tutti'", () => {
    expect(
      alberoDaPannello(stato({ "Wallbox richiesto": { type: "boolean", value: "yes" } }), CATALOGO)
        .nodi[0],
    ).toMatchObject({ operatore: "vero" })

    // "Tutti" non e' un vincolo: non deve produrre una condizione.
    expect(
      alberoDaPannello(stato({ "Wallbox richiesto": { type: "boolean", value: "all" } }), CATALOGO)
        .nodi,
    ).toHaveLength(0)
  })

  it("usa 'fra' quando ci sono entrambi gli estremi", () => {
    const albero = alberoDaPannello(
      stato({ Valutazione: { type: "number", min: "10", max: "40" } }),
      CATALOGO,
    )
    expect(albero.nodi[0]).toMatchObject({ operatore: "fra", valori: ["10", "40"] })
  })

  it("un solo estremo diventa 'maggiore' o 'minore', non un intervallo scartato", () => {
    expect(
      alberoDaPannello(stato({ Valutazione: { type: "number", min: "10", max: "" } }), CATALOGO)
        .nodi[0],
    ).toMatchObject({ operatore: "maggiore", valori: ["10"] })

    expect(
      alberoDaPannello(stato({ Valutazione: { type: "number", min: "", max: "40" } }), CATALOGO)
        .nodi[0],
    ).toMatchObject({ operatore: "minore", valori: ["40"] })
  })

  it("sulle date usa 'dopo' e 'prima'", () => {
    expect(
      alberoDaPannello(
        stato({ "Ora creazione": { type: "date", from: "2026-01-01", to: "" } }),
        CATALOGO,
      ).nodi[0],
    ).toMatchObject({ operatore: "dopo" })
  })

  it("scarta i campi vuoti e quelli fuori catalogo", () => {
    const albero = alberoDaPannello(
      stato({
        "Nome Lead": { type: "text", contains: "   " },
        "Campo Inventato": { type: "text", contains: "x" },
      }),
      CATALOGO,
    )
    expect(albero.nodi).toHaveLength(0)
  })

  it("produce un albero che supera la validazione", () => {
    // E' il punto della conversione: quello che esce dal pannello deve
    // poter essere salvato e riletto dal costruttore.
    const albero = alberoDaPannello(
      stato({
        "Nome Lead": { type: "text", contains: "rossi" },
        "Stato Lead": { type: "enum", selected: ["Perso"] },
      }),
      CATALOGO,
    )
    expect(validaAlbero(albero, CATALOGO).ok).toBe(true)
  })
})
