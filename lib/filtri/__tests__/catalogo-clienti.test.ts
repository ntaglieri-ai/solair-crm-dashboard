import { describe, expect, it } from "vitest"
import { validaAlbero, type Gruppo } from "../albero"
import { COLONNE_CLIENTI, catalogoClientiCompleto, gruppiCampiClienti } from "../catalogo-clienti"
import { catalogoDaGruppi } from "../catalogo-lead"
import { traduciAlbero } from "../traduci"

/**
 * Il filtro dei Clienti attraversa due cataloghi diversi: quello costruito
 * dal layout nel browser, che sa quali campi hanno una tendina, e quello
 * piatto sul server, che non lo sa. Quando i due non si parlavano, filtrare
 * per Stato e Installatore non restringeva niente e la lista restava intera.
 */

const LAYOUT = [
  {
    pageKey: "anagrafica",
    label: "Anagrafica",
    blocchi: [
      {
        campi: [
          { fieldKey: "Stato", visible: true },
          { fieldKey: "Installatore", visible: true },
        ],
      },
    ],
  },
] as never

const ALBERO: Gruppo = {
  tipo: "gruppo",
  connettore: "e",
  nodi: [
    { tipo: "condizione", campo: "Stato", operatore: "uno_di", valori: ["In Esecuzione"] },
    { tipo: "condizione", campo: "Installatore", operatore: "uno_di", valori: ["Ca.Gi Srl"] },
  ],
}

describe("catalogo clienti", () => {
  it("il pannello offre i campi con tendina come elenco", () => {
    const campi = catalogoDaGruppi(
      gruppiCampiClienti(LAYOUT, {
        Stato: ["In Esecuzione"],
        Installatore: ["Ca.Gi Srl"],
      }),
    )
    expect(campi.find((campo) => campo.chiave === "Stato")?.tipo).toBe("elenco")
    expect(campi.find((campo) => campo.chiave === "Installatore")?.tipo).toBe("elenco")
  })

  it("il server accetta e traduce quello che il pannello compone", () => {
    const catalogo = catalogoClientiCompleto()
    const validato = validaAlbero(ALBERO, catalogo)
    expect(validato.ok).toBe(true)
    if (!validato.ok) return

    const tradotto = traduciAlbero(validato.gruppo, catalogo, COLONNE_CLIENTI)
    expect(tradotto.ok).toBe(true)
    if (!tradotto.ok) return
    expect(tradotto.espressione).toBe(
      'and(stato.in.("In Esecuzione"),installatore.in.("Ca.Gi Srl"))',
    )
  })

  it("un campo fuori catalogo resta irraggiungibile", () => {
    const albero: Gruppo = {
      tipo: "gruppo",
      connettore: "e",
      nodi: [{ tipo: "condizione", campo: "password", operatore: "uno_di", valori: ["x"] }],
    }
    expect(validaAlbero(albero, catalogoClientiCompleto()).ok).toBe(false)
  })

  it("un valore con virgole e virgolette non cambia la struttura della query", () => {
    const albero: Gruppo = {
      tipo: "gruppo",
      connettore: "e",
      nodi: [{ tipo: "condizione", campo: "Stato", operatore: "uno_di", valori: ['a,b)","c'] }],
    }
    const catalogo = catalogoClientiCompleto()
    const validato = validaAlbero(albero, catalogo)
    expect(validato.ok).toBe(true)
    if (!validato.ok) return
    const tradotto = traduciAlbero(validato.gruppo, catalogo, COLONNE_CLIENTI)
    expect(tradotto.ok).toBe(true)
    if (!tradotto.ok) return
    expect(tradotto.espressione).toBe('stato.in.("a,b)"",""c")')
  })
})
