import { describe, expect, it } from "vitest"
import { catalogoDaLayout, colonnePerCampo, type DescrittoreCampo } from "../catalogo-da-layout"
import type { LayoutBlocco, LayoutCampo, LayoutPagina } from "@/lib/crm-settings/layout"

function campo(fieldKey: string, extra: Partial<LayoutCampo> = {}): LayoutCampo {
  return {
    id: `c-${fieldKey}`,
    origine: "system",
    fieldKey,
    labelOverride: null,
    ordinamento: 0,
    visible: true,
    span: 1,
    solaLettura: false,
    formato: {},
    formula: null,
    ...extra,
  }
}

function blocco(campi: LayoutCampo[]): LayoutBlocco {
  return {
    id: "b1",
    blockKey: "b1",
    label: "Blocco",
    mostraTitolo: true,
    colonne: 2,
    ordinamento: 0,
    visible: true,
    campi,
  }
}

function pagina(pageKey: string, label: string, campi: LayoutCampo[]): LayoutPagina {
  return {
    id: `p-${pageKey}`,
    pageKey,
    label,
    icona: null,
    ordinamento: 0,
    visible: true,
    componente: null,
    blocchi: campi.length ? [blocco(campi)] : [],
  }
}

const TIPI: Record<string, DescrittoreCampo> = {
  "Nome Clienti": { tipo: "text" },
  "Capacità Batterie": { tipo: "numeric" },
  CER: { tipo: "boolean" },
  "Data Sopralluogo": { tipo: "timestamp" },
  "Modalità di Pagamento": { tipo: "text", opzioni: ["30-50-20", "50-50"] },
}

const descrittore = (chiave: string) => TIPI[chiave] ?? null

describe("catalogoDaLayout", () => {
  it("crea un gruppo per pagina, con l'etichetta della pagina", () => {
    const gruppi = catalogoDaLayout(
      [
        pagina("anagrafica", "Anagrafica", [campo("Nome Clienti")]),
        pagina("impianto", "Impianto", [campo("Capacità Batterie")]),
      ],
      descrittore,
    )
    expect(gruppi.map((g) => g.etichetta)).toEqual(["Anagrafica", "Impianto"])
  })

  it("traduce i tipi del modulo in tipi filtrabili", () => {
    const gruppi = catalogoDaLayout(
      [
        pagina("x", "X", [
          campo("Nome Clienti"),
          campo("Capacità Batterie"),
          campo("CER"),
          campo("Data Sopralluogo"),
        ]),
      ],
      descrittore,
    )
    expect(gruppi[0].campi.map((c) => c.tipo)).toEqual(["testo", "numero", "booleano", "data"])
  })

  it("un campo con valori configurati diventa un elenco", () => {
    // Cercare scrivendo fra cinque scelte prefissate sarebbe inutilmente
    // faticoso.
    const gruppi = catalogoDaLayout(
      [pagina("x", "X", [campo("Modalità di Pagamento")])],
      descrittore,
    )
    expect(gruppi[0].campi[0].tipo).toBe("elenco")
    expect(gruppi[0].campi[0].opzioni).toEqual(["30-50-20", "50-50"])
  })

  it("lascia fuori i campi calcolati", () => {
    // Non sono colonne: il valore nasce da una formula al momento di
    // disegnare la scheda, e il database non saprebbe filtrarci sopra.
    const gruppi = catalogoDaLayout(
      [
        pagina("x", "X", [
          campo("Nome Clienti"),
          campo("Saldo", { formula: { expr: "{a}-{b}" } }),
        ]),
      ],
      (chiave) => (chiave === "Saldo" ? { tipo: "numeric" } : descrittore(chiave)),
    )
    expect(gruppi[0].campi.map((c) => c.chiave)).toEqual(["Nome Clienti"])
  })

  it("lascia fuori i campi nascosti e quelli di tipo sconosciuto", () => {
    const gruppi = catalogoDaLayout(
      [
        pagina("x", "X", [
          campo("Nome Clienti", { visible: false }),
          campo("Campo Misterioso"),
        ]),
      ],
      descrittore,
    )
    expect(gruppi).toHaveLength(0)
  })

  it("salta le pagine senza campi filtrabili", () => {
    // Le pagine a componente dedicato (Allegati, Calendario) non devono
    // comparire come gruppi vuoti.
    const gruppi = catalogoDaLayout(
      [pagina("allegati", "Allegati", []), pagina("anagrafica", "Anagrafica", [campo("Nome Clienti")])],
      descrittore,
    )
    expect(gruppi.map((g) => g.chiave)).toEqual(["anagrafica"])
  })

  it("usa l'etichetta personalizzata quando c'e'", () => {
    const gruppi = catalogoDaLayout(
      [pagina("x", "X", [campo("Nome Clienti", { labelOverride: "Ragione sociale" })])],
      descrittore,
    )
    expect(gruppi[0].campi[0].etichetta).toBe("Ragione sociale")
  })
})

describe("colonnePerCampo", () => {
  it("mappa la chiave applicativa sulla colonna del database", () => {
    const mappa = colonnePerCampo([
      { appField: "Nome Clienti", column: "nome_clienti" },
      { appField: "CER", column: "cer" },
    ])
    expect(mappa["Nome Clienti"]).toBe("nome_clienti")
    expect(mappa["Campo assente"]).toBeUndefined()
  })
})
