import { describe, expect, it } from "vitest"
import {
  ancoraPagina,
  campoScrivibile,
  formattaValore,
  mappaValori,
  paginePiene,
  valoreCampo,
} from "../layout-render"
import type { LayoutCampo, LayoutPagina } from "../layout"

function campo(fieldKey: string, extra: Partial<LayoutCampo> = {}): LayoutCampo {
  return {
    id: `id-${fieldKey}`,
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

describe("mappaValori", () => {
  it("tiene i valori semplici e scarta oggetti e array", () => {
    const mappa = mappaValori({
      Saldo: 9895,
      Nome: "Mario",
      CER: true,
      Vuoto: null,
      compiti: [{ id: "1" }],
      annidato: { a: 1 },
    })
    expect(mappa.get("Saldo")).toBe(9895)
    expect(mappa.get("Nome")).toBe("Mario")
    expect(mappa.get("CER")).toBe(true)
    expect(mappa.get("Vuoto")).toBeNull()
    // Un array o un oggetto in una formula non avrebbe significato.
    expect(mappa.has("compiti")).toBe(false)
    expect(mappa.has("annidato")).toBe(false)
  })
})

describe("valoreCampo", () => {
  const record = {
    "Importo Contrattuale": 19790,
    "Sconto COMBO": null,
    "Modalità di Pagamento": "50-50",
  }
  const valori = mappaValori(record)

  it("legge un campo normale dal record", () => {
    expect(valoreCampo(campo("Importo Contrattuale"), record, valori)).toEqual({
      stato: "valore",
      valore: 19790,
    })
  })

  it("calcola un campo con formula invece di leggerlo", () => {
    // Il valore non sta nel record: viene dalla formula, come su Zoho.
    const saldo = campo("Saldo", {
      formula: {
        expr: "If({Modalità di Pagamento}=='50-50',({Importo Contrattuale}-{Sconto COMBO})*0.5,0)",
      },
    })
    expect(valoreCampo(saldo, record, valori)).toEqual({ stato: "calcolato", valore: 9895 })
  })

  it("una formula rotta torna errore senza far saltare la scheda", () => {
    const rotto = campo("Rotto", { formula: { expr: "({a} + " } })
    const esito = valoreCampo(rotto, record, valori)
    expect(esito.stato).toBe("errore")
  })

  it("un campo assente dal record torna undefined, non esplode", () => {
    expect(valoreCampo(campo("Mai visto"), record, valori)).toEqual({
      stato: "valore",
      valore: undefined,
    })
  })
})

describe("formattaValore", () => {
  it("usa il formato italiano per i numeri", () => {
    expect(formattaValore(19790, {})).toBe("19.790")
    expect(formattaValore(12.285, { decimali: 2 })).toBe("12,29")
  })

  it("raggruppa anche le migliaia di quattro cifre, come faceva Zoho", () => {
    // Il locale italiano da solo lascerebbe "9895": Zoho stampava "9.895" e
    // chi legge questi importi ogni giorno e' abituato a quella forma.
    expect(formattaValore(9895, {})).toBe("9.895")
  })

  it("aggiunge simbolo di valuta e percentuale secondo il tipo", () => {
    expect(formattaValore(9895, { decimali: 2 }, "currency")).toBe("9.895,00 €")
    expect(formattaValore(40, {}, "percent")).toBe("40%")
  })

  it("rispetta una valuta diversa da euro", () => {
    expect(formattaValore(100, { decimali: 0, valuta: "CHF" }, "currency")).toBe("100 CHF")
  })

  it("mostra i booleani in italiano", () => {
    expect(formattaValore(true, {})).toBe("Sì")
    expect(formattaValore(false, {})).toBe("No")
  })

  it("usa il segnaposto per i valori vuoti", () => {
    expect(formattaValore(null, {})).toBe("—")
    expect(formattaValore("", {})).toBe("—")
    expect(formattaValore(undefined, {})).toBe("—")
    expect(formattaValore(null, { placeholder: "non indicato" })).toBe("non indicato")
  })

  it("non stampa Infinity o NaN", () => {
    expect(formattaValore(Number.POSITIVE_INFINITY, {})).toBe("—")
    expect(formattaValore(Number.NaN, {})).toBe("—")
  })
})

describe("campoScrivibile", () => {
  it("un campo normale si modifica", () => {
    expect(campoScrivibile(campo("POD"))).toBe(true)
  })

  it("un campo calcolato non si modifica", () => {
    expect(campoScrivibile(campo("Saldo", { formula: { expr: "{a}+{b}" } }))).toBe(false)
  })

  it("un campo congelato dall'admin non si modifica", () => {
    expect(campoScrivibile(campo("POD", { solaLettura: true }))).toBe(false)
  })
})

describe("paginePiene", () => {
  function pagina(pageKey: string, extra: Partial<LayoutPagina> = {}): LayoutPagina {
    return {
      id: `p-${pageKey}`,
      pageKey,
      label: pageKey,
      icona: null,
      ordinamento: 0,
      visible: true,
      componente: null,
      blocchi: [],
      ...extra,
    }
  }

  it("tiene le pagine con campi e quelle con componente dedicato", () => {
    const conCampi = pagina("anagrafica", {
      blocchi: [
        {
          id: "b1",
          blockKey: "b1",
          label: "b1",
          mostraTitolo: true,
          colonne: 2,
          ordinamento: 0,
          visible: true,
          campi: [campo("Nome")],
        },
      ],
    })
    const conComponente = pagina("documenti", { componente: "allegati" })
    const vuota = pagina("vuota")

    const risultato = paginePiene([conCampi, conComponente, vuota])
    expect(risultato.map((p) => p.pageKey)).toEqual(["anagrafica", "documenti"])
  })

  it("scarta una pagina i cui blocchi non hanno campi", () => {
    const senzaCampi = pagina("vuota", {
      blocchi: [
        {
          id: "b1",
          blockKey: "b1",
          label: "b1",
          mostraTitolo: true,
          colonne: 2,
          ordinamento: 0,
          visible: true,
          campi: [],
        },
      ],
    })
    expect(paginePiene([senzaCampi])).toHaveLength(0)
  })
})

describe("ancoraPagina", () => {
  it("deriva l'ancora dalla chiave, non dall'etichetta", () => {
    // L'etichetta cambia con una rinomina, la chiave no: i link della navbar
    // devono restare validi.
    expect(ancoraPagina("iter-burocratico")).toBe("section-iter-burocratico")
  })
})
