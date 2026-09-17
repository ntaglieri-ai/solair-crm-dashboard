import { describe, expect, it } from "vitest"
import { campiSegnapostoPerModulo } from "../template-fields"
import { CLIENTI_RECORD_FIELDS } from "@/lib/clienti/zoho-fields"
import { LEAD_RECORD_FIELDS } from "@/lib/leads/field-map"
import { INSTALLATORI_RECORD_FIELDS } from "@/lib/installatori/record-fields"

/**
 * Il catalogo campi che l'editor propone deve essere lo stesso che
 * lib/email/bulk-targets.ts usa per popolare `campi` all'invio: un'etichetta
 * proposta dalla lista e non riconosciuta al momento della spedizione
 * sarebbe un buco silenzioso peggiore di quello che questa funzionalita'
 * dovrebbe chiudere.
 */
describe("campiSegnapostoPerModulo", () => {
  it("propone tutti i campi Clienti, in ordine alfabetico", () => {
    const campi = campiSegnapostoPerModulo("clienti")
    expect(new Set(campi)).toEqual(new Set(CLIENTI_RECORD_FIELDS.map((f) => f.appField)))
    expect(campi).toEqual([...campi].sort((a, b) => a.localeCompare(b, "it")))
  })

  it("propone tutti i campi Lead", () => {
    const campi = campiSegnapostoPerModulo("lead")
    expect(new Set(campi)).toEqual(new Set(LEAD_RECORD_FIELDS.map((f) => f.appField)))
  })

  it("propone tutti i campi Installatori", () => {
    const campi = campiSegnapostoPerModulo("installatori")
    expect(new Set(campi)).toEqual(new Set(INSTALLATORI_RECORD_FIELDS.map((f) => f.appField)))
  })

  it("non ripete la stessa etichetta due volte", () => {
    for (const modulo of ["clienti", "lead", "installatori"] as const) {
      const campi = campiSegnapostoPerModulo(modulo)
      expect(campi.length).toBe(new Set(campi).size)
    }
  })
})
