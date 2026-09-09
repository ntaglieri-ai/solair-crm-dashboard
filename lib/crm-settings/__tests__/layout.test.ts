import { describe, expect, it } from "vitest"
import {
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
