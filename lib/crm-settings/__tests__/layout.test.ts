import { describe, expect, it } from "vitest"
import {
  applicaOrdineBlocchi,
  applicaOrdineCampi,
  applicaOrdinePersonale,
  campiDuplicati,
  campoModificabile,
  soloVisibili,
  campoCalcolato,
  LAYOUT_CAMPO_TIPI,
  LAYOUT_CAMPO_TIPO_LABEL,
  type LayoutCampo,
  type LayoutPagina,
} from "../layout"

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

function pagina(
  pageKey: string,
  ordinamento: number,
  campi: LayoutCampo[] = [],
  extra: Partial<LayoutPagina> = {},
): LayoutPagina {
  return {
    id: `pag-${pageKey}`,
    pageKey,
    label: pageKey,
    icona: null,
    ordinamento,
    visible: true,
    componente: null,
    blocchi: [
      {
        id: `blk-${pageKey}`,
        blockKey: `${pageKey}-blocco`,
        label: pageKey,
        mostraTitolo: true,
        colonne: 2,
        ordinamento: 0,
        visible: true,
        campi,
      },
    ],
    ...extra,
  }
}

describe("applicaOrdinePersonale", () => {
  const pagine = [
    pagina("anagrafica", 0),
    pagina("impianto", 1),
    pagina("pagamenti", 2),
  ]

  it("senza preferenza mantiene l'ordine dell'admin", () => {
    expect(applicaOrdinePersonale(pagine, []).map((p) => p.pageKey)).toEqual([
      "anagrafica",
      "impianto",
      "pagamenti",
    ])
  })

  it("riordina secondo la preferenza dell'utente", () => {
    const ordine = ["impianto", "anagrafica", "pagamenti"]
    expect(applicaOrdinePersonale(pagine, ordine).map((p) => p.pageKey)).toEqual(ordine)
  })

  it("mette in coda le pagine non elencate nella preferenza", () => {
    // Preferenza salvata prima che "pagamenti" esistesse: deve comunque
    // comparire, non sparire.
    const risultato = applicaOrdinePersonale(pagine, ["impianto", "anagrafica"])
    expect(risultato.map((p) => p.pageKey)).toEqual(["impianto", "anagrafica", "pagamenti"])
  })

  it("ignora chiavi della preferenza che non esistono piu'", () => {
    const risultato = applicaOrdinePersonale(pagine, ["sparita", "pagamenti"])
    expect(risultato.map((p) => p.pageKey)).toEqual(["pagamenti", "anagrafica", "impianto"])
  })

  it("non muta l'array ricevuto", () => {
    const originale = pagine.map((p) => p.pageKey)
    applicaOrdinePersonale(pagine, ["pagamenti", "impianto", "anagrafica"])
    expect(pagine.map((p) => p.pageKey)).toEqual(originale)
  })
})

describe("soloVisibili", () => {
  it("toglie pagine, blocchi e campi nascosti", () => {
    const pagine: LayoutPagina[] = [
      pagina("anagrafica", 0, [campo("Nome Clienti"), campo("Assistenza", { visible: false })]),
      pagina("nascosta", 1, [campo("Foglio")], { visible: false }),
    ]

    const risultato = soloVisibili(pagine)
    expect(risultato).toHaveLength(1)
    expect(risultato[0].blocchi[0].campi.map((c) => c.fieldKey)).toEqual(["Nome Clienti"])
  })

  it("toglie un blocco nascosto lasciando la pagina", () => {
    const base = pagina("impianto", 0, [campo("Nr. Moduli")])
    base.blocchi[0].visible = false

    const risultato = soloVisibili([base])
    expect(risultato).toHaveLength(1)
    expect(risultato[0].blocchi).toHaveLength(0)
  })
})

describe("campiDuplicati", () => {
  it("non segnala nulla quando ogni campo compare una volta sola", () => {
    const pagine = [
      pagina("anagrafica", 0, [campo("Nome Clienti")]),
      pagina("pagamenti", 1, [campo("Saldo")]),
    ]
    expect(campiDuplicati(pagine)).toEqual([])
  })

  it("segnala lo stesso campo piazzato in due pagine diverse", () => {
    const pagine = [
      pagina("anagrafica", 0, [campo("Saldo")]),
      pagina("pagamenti", 1, [campo("Saldo")]),
    ]
    expect(campiDuplicati(pagine)).toEqual(["system:Saldo"])
  })

  it("distingue system e custom con la stessa chiave", () => {
    const pagine = [
      pagina("anagrafica", 0, [
        campo("Verifica"),
        campo("Verifica", { origine: "custom", id: "custom-verifica" }),
      ]),
    ]
    expect(campiDuplicati(pagine)).toEqual([])
  })
})

describe("campi calcolati", () => {
  it("un campo con formula e' calcolato, uno senza no", () => {
    expect(campoCalcolato(campo("Saldo", { formula: { expr: "{a} - {b}" } }))).toBe(true)
    expect(campoCalcolato(campo("POD"))).toBe(false)
  })

  it("un campo con formula non e' modificabile", () => {
    // Il tipo resta quello del risultato (currency): e' la formula a
    // renderlo non scrivibile, non il tipo.
    const calcolato = campo("Saldo", {
      formula: { expr: "{Importo Contrattuale} - {1° Tranche}" },
    })
    expect(campoModificabile(calcolato)).toBe(false)
  })

  it("un campo congelato dall'admin non e' modificabile", () => {
    expect(campoModificabile(campo("POD", { solaLettura: true }))).toBe(false)
  })

  it("un campo normale resta modificabile", () => {
    expect(campoModificabile(campo("POD"))).toBe(true)
  })
})

describe("palette dei tipi", () => {
  it("copre i tipi Zoho che mancavano", () => {
    for (const tipo of ["decimal", "percent", "url"]) {
      expect(LAYOUT_CAMPO_TIPI).toContain(tipo)
    }
  })

  it("non espone formula come tipo: e' una proprieta' del campo", () => {
    expect(LAYOUT_CAMPO_TIPI).not.toContain("formula")
  })

  it("ogni tipo ha un'etichetta italiana per la palette", () => {
    for (const tipo of LAYOUT_CAMPO_TIPI) {
      expect(LAYOUT_CAMPO_TIPO_LABEL[tipo]).toBeTruthy()
    }
  })
})

describe("applicaOrdineBlocchi", () => {
  function paginaConBlocchi(pageKey: string, chiavi: string[]): LayoutPagina {
    return {
      id: `p-${pageKey}`,
      pageKey,
      label: pageKey,
      icona: null,
      ordinamento: 0,
      visible: true,
      componente: null,
      blocchi: chiavi.map((blockKey, indice) => ({
        id: `b-${blockKey}`,
        blockKey,
        label: blockKey,
        mostraTitolo: true,
        colonne: 2,
        ordinamento: indice,
        visible: true,
        campi: [],
      })),
    }
  }

  const pagine = [paginaConBlocchi("impianto", ["ftv", "zavorre", "termico"])]

  it("senza preferenza lascia l'ordine dell'admin", () => {
    const risultato = applicaOrdineBlocchi(pagine, {})
    expect(risultato[0].blocchi.map((b) => b.blockKey)).toEqual(["ftv", "zavorre", "termico"])
  })

  it("riordina i blocchi della pagina indicata", () => {
    const risultato = applicaOrdineBlocchi(pagine, { impianto: ["termico", "ftv", "zavorre"] })
    expect(risultato[0].blocchi.map((b) => b.blockKey)).toEqual(["termico", "ftv", "zavorre"])
  })

  it("mette in coda i blocchi non elencati nella preferenza", () => {
    // Un blocco aggiunto dall'admin dopo il salvataggio deve comparire
    // comunque, non sparire.
    const risultato = applicaOrdineBlocchi(pagine, { impianto: ["termico"] })
    expect(risultato[0].blocchi.map((b) => b.blockKey)).toEqual(["termico", "ftv", "zavorre"])
  })

  it("ignora preferenze riferite ad altre pagine", () => {
    const risultato = applicaOrdineBlocchi(pagine, { anagrafica: ["x", "y"] })
    expect(risultato[0].blocchi.map((b) => b.blockKey)).toEqual(["ftv", "zavorre", "termico"])
  })

  it("non muta le pagine ricevute", () => {
    const originale = pagine[0].blocchi.map((b) => b.blockKey)
    applicaOrdineBlocchi(pagine, { impianto: ["zavorre", "ftv", "termico"] })
    expect(pagine[0].blocchi.map((b) => b.blockKey)).toEqual(originale)
  })
})

describe("applicaOrdineCampi", () => {
  function conCampi(chiavi: string[]): LayoutPagina {
    return {
      id: "p-impianto",
      pageKey: "impianto",
      label: "Impianto",
      icona: null,
      ordinamento: 0,
      visible: true,
      componente: null,
      blocchi: [
        {
          id: "b-ftv",
          blockKey: "ftv",
          label: "FTV",
          mostraTitolo: true,
          colonne: 2,
          ordinamento: 0,
          visible: true,
          campi: chiavi.map((fieldKey, indice) => campo(fieldKey, { ordinamento: indice })),
        },
      ],
    }
  }

  const pagine = [conCampi(["Nr. Moduli", "COD- MODULI", "Nr. Inverter"])]

  it("senza preferenza lascia l'ordine dell'admin", () => {
    const risultato = applicaOrdineCampi(pagine, {})
    expect(risultato[0].blocchi[0].campi.map((c) => c.fieldKey)).toEqual([
      "Nr. Moduli",
      "COD- MODULI",
      "Nr. Inverter",
    ])
  })

  it("riordina i campi del blocco indicato", () => {
    const risultato = applicaOrdineCampi(pagine, {
      ftv: ["Nr. Inverter", "Nr. Moduli", "COD- MODULI"],
    })
    expect(risultato[0].blocchi[0].campi.map((c) => c.fieldKey)).toEqual([
      "Nr. Inverter",
      "Nr. Moduli",
      "COD- MODULI",
    ])
  })

  it("mette in coda i campi non elencati", () => {
    const risultato = applicaOrdineCampi(pagine, { ftv: ["Nr. Inverter"] })
    expect(risultato[0].blocchi[0].campi.map((c) => c.fieldKey)).toEqual([
      "Nr. Inverter",
      "Nr. Moduli",
      "COD- MODULI",
    ])
  })

  it("non muta le pagine ricevute", () => {
    const originale = pagine[0].blocchi[0].campi.map((c) => c.fieldKey)
    applicaOrdineCampi(pagine, { ftv: ["Nr. Inverter", "Nr. Moduli", "COD- MODULI"] })
    expect(pagine[0].blocchi[0].campi.map((c) => c.fieldKey)).toEqual(originale)
  })
})
