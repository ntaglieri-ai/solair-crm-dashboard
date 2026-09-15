import { describe, expect, it } from "vitest"
import { cleanLeadOptionValue, isLeadOptionColumn, mergeLeadOptions } from "../field-options"
import { gruppiCampiLead } from "@/lib/filtri/catalogo-lead"
import { CRM_FIELD_CATALOG } from "@/lib/permissions/field-catalog"

describe("campi Meta Lead", () => {
  it.each(["meta_ad_name", "meta_adset_name"] as const)("mantiene nomi liberi e valori ricevuti dal webhook: %s", (column) => {
    expect(isLeadOptionColumn(column)).toBe(true)
    expect(cleanLeadOptionValue(column, "2026-09-15 Promo")).toBe("2026-09-15 Promo")
    expect(cleanLeadOptionValue(column, "120251768004390272")).toBe("120251768004390272")
    expect(mergeLeadOptions(column, [{ value: "Manuale", label: "Manuale" }], ["Webhook", "Manuale"])
      .map(option => option.value)).toEqual(["Manuale", "Webhook"])
    expect(CRM_FIELD_CATALOG.lead.some(field => field.key === column)).toBe(true)
  })
  it("espone i valori delle tendine nei filtri", () => {
    const fields = gruppiCampiLead({ stati: [], origini: [], sedi: [], proprietari: [], tag: [], adMeta: ["Annuncio"], adsetMeta: ["Gruppo"] }).flatMap(group => group.campi)
    expect(fields.find(field => field.chiave === "Ad Meta")).toMatchObject({ tipo: "elenco", opzioni: ["Annuncio"] })
    expect(fields.find(field => field.chiave === "Adset Meta")).toMatchObject({ tipo: "elenco", opzioni: ["Gruppo"] })
  })
})
