import { describe, expect, it } from "vitest"
import { decidiTrascinamento, type DatiTrascinamento } from "../layout-dnd"
import type { LayoutPagina } from "../layout"

const campo = (id: string) => ({ id, fieldKey: id, origine: "system", labelOverride: null, ordinamento: 0, visible: true, span: 1, solaLettura: false, formato: {}, formula: null })

// Anagrafica com'e' davvero: "Informazioni Clienti" (che contiene Ad Meta) e
// "Informazioni indirizzo" nella stessa pagina; "Pratiche Enel" su un'altra.
const pagine = [
  {
    id: "pag-anagrafica", pageKey: "anagrafica", label: "Anagrafica", icona: null,
    ordinamento: 0, visible: true, componente: null,
    blocchi: [
      { id: "b-clienti", blockKey: "clienti", label: "Informazioni Clienti", mostraTitolo: true, colonne: 2, ordinamento: 0, visible: true, campi: [campo("adset-meta"), campo("ad-meta")] },
      { id: "b-indirizzo", blockKey: "indirizzo", label: "Informazioni indirizzo", mostraTitolo: true, colonne: 2, ordinamento: 1, visible: true, campi: [campo("via"), campo("citta")] },
      { id: "b-vuoto", blockKey: "vuoto", label: "Blocco vuoto", mostraTitolo: true, colonne: 1, ordinamento: 2, visible: true, campi: [] },
    ],
  },
  {
    id: "pag-iter", pageKey: "iter", label: "Iter burocratico", icona: null,
    ordinamento: 1, visible: true, componente: null,
    blocchi: [{ id: "b-enel", blockKey: "enel", label: "Pratiche Enel", mostraTitolo: true, colonne: 2, ordinamento: 0, visible: true, campi: [campo("pod")] }],
  },
] as unknown as LayoutPagina[]

const dCampo = (bloccoId: string, paginaId = "pag-anagrafica"): DatiTrascinamento => ({ tipo: "campo", paginaId, bloccoId })
const dArea = (bloccoId: string, paginaId = "pag-anagrafica"): DatiTrascinamento => ({ tipo: "area-blocco", paginaId, bloccoId })
const dBlocco = (bloccoId: string, paginaId = "pag-anagrafica"): DatiTrascinamento => ({ tipo: "blocco", paginaId, bloccoId })

describe("trascinamento nel layout editor", () => {
  it("sposta un campo in un altro blocco della stessa pagina", () => {
    // Il caso segnalato: Ad Meta -> Informazioni indirizzo.
    expect(decidiTrascinamento(pagine, "ad-meta", "via", dCampo("b-clienti"), dCampo("b-indirizzo"))).toEqual({
      azione: "sposta-campo", campoId: "ad-meta", origine: "b-clienti", destinazione: "b-indirizzo", indice: 0,
    })
  })

  it("accetta il rilascio sull'area del blocco, non solo su un campo", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "area-b-indirizzo", dCampo("b-clienti"), dArea("b-indirizzo")))
      .toEqual({ azione: "sposta-campo", campoId: "ad-meta", origine: "b-clienti", destinazione: "b-indirizzo", indice: 2 })
  })

  it("accetta un blocco vuoto come destinazione", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "area-b-vuoto", dCampo("b-clienti"), dArea("b-vuoto")))
      .toEqual({ azione: "sposta-campo", campoId: "ad-meta", origine: "b-clienti", destinazione: "b-vuoto", indice: 0 })
  })

  it("accetta il rilascio sul riquadro del blocco di destinazione", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "b-indirizzo", dCampo("b-clienti"), dBlocco("b-indirizzo")))
      .toEqual({ azione: "sposta-campo", campoId: "ad-meta", origine: "b-clienti", destinazione: "b-indirizzo", indice: 2 })
  })

  it("riordina dentro lo stesso blocco", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "adset-meta", dCampo("b-clienti"), dCampo("b-clienti")))
      .toEqual({ azione: "riordina-campi", bloccoId: "b-clienti", ordine: ["ad-meta", "adset-meta"] })
  })

  it("non fa sparire il campo se il rilascio cade nel vuoto del proprio blocco", () => {
    // Prima questo dava indice -1 e un no-op silenzioso.
    expect(decidiTrascinamento(pagine, "adset-meta", "area-b-clienti", dCampo("b-clienti"), dArea("b-clienti")))
      .toEqual({ azione: "riordina-campi", bloccoId: "b-clienti", ordine: ["ad-meta", "adset-meta"] })
  })

  it("RIFIUTA un campo verso un blocco di un'altra pagina", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "pod", dCampo("b-clienti"), dCampo("b-enel", "pag-iter"))).toBeNull()
    expect(decidiTrascinamento(pagine, "ad-meta", "area-b-enel", dCampo("b-clienti"), dArea("b-enel", "pag-iter"))).toBeNull()
  })

  it("riordina i blocchi dentro la pagina, mai fra pagine", () => {
    expect(decidiTrascinamento(pagine, "b-indirizzo", "b-clienti", dBlocco("b-indirizzo"), dBlocco("b-clienti")))
      .toEqual({ azione: "riordina-blocchi", paginaId: "pag-anagrafica", ordine: ["b-indirizzo", "b-clienti", "b-vuoto"] })
    expect(decidiTrascinamento(pagine, "b-clienti", "b-enel", dBlocco("b-clienti"), dBlocco("b-enel", "pag-iter"))).toBeNull()
  })

  it("riordina le pagine", () => {
    expect(decidiTrascinamento(pagine, "pag-iter", "pag-anagrafica", { tipo: "pagina", paginaId: "pag-iter" }, { tipo: "pagina", paginaId: "pag-anagrafica" }))
      .toEqual({ azione: "riordina-pagine", ordine: ["pag-iter", "pag-anagrafica"] })
  })

  it("ignora i rilasci senza senso", () => {
    expect(decidiTrascinamento(pagine, "ad-meta", "ad-meta", dCampo("b-clienti"), dCampo("b-clienti"))).toBeNull()
    expect(decidiTrascinamento(pagine, "ad-meta", "via", undefined, dCampo("b-indirizzo"))).toBeNull()
    expect(decidiTrascinamento(pagine, "b-clienti", "via", dBlocco("b-clienti"), dCampo("b-indirizzo"))).toBeNull()
  })
})
