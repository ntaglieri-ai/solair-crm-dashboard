import { describe, expect, it } from "vitest"
import { CLIENTE_COLUMNS } from "@/lib/mock-data"
import { CLIENTI_LIST_COLUMN_NAMES } from "@/lib/clienti/list-columns"
import { CLIENTI_RECORD_FIELDS, CLIENTI_ZOHO_FIELDS } from "@/lib/clienti/zoho-fields"
import { CRM_FIELD_CATALOG } from "@/lib/permissions/field-catalog"
import { CLIENTI_ZOHO_FIELDS as CLIENTI_ZOHO_FIELDS_MJS } from "../../../scripts/migrations/clienti-zoho-fields.mjs"

const VIRTUAL_UI_FIELDS = new Set([
  "Badge dell'attività",
  "Badge di nota",
  "Sede",
  "Allegati",
])

const INTERNAL_NON_UI_FIELDS = new Set([
  "ID record",
  "Clienti Proprietario.id",
  "Creato da.id",
  "Modificato da.id",
  "Orario del registro delle modifiche",
  "Locked",
  "Ora dell’ultimo arricchimento",
  "Stato arricchito",
  "Installatore.id",
  "EPS previsto",
  "Adesione CER prevista",
  "Costi extra sopralluogo",
  "Consenso e-mail",
])

describe("campi Zoho Clienti", () => {
  it("mantiene allineate la lista TypeScript e quella usata dallo script legacy", () => {
    expect(CLIENTI_ZOHO_FIELDS_MJS).toEqual(CLIENTI_ZOHO_FIELDS)
  })

  it("espone in UI ogni campo importato che non sia tecnico o nativo CRM", () => {
    const uiFields = new Set<string>(CLIENTE_COLUMNS.map((column) => column.id))
    const missing = CLIENTI_RECORD_FIELDS
      .filter((field) => !INTERNAL_NON_UI_FIELDS.has(field.appField))
      .filter((field) => !uiFields.has(field.appField))
      .map((field) => field.appField)

    expect(missing).toEqual([])
  })

  it("include nei permessi tutti i campi cliente letti o scritti dal record", () => {
    const permissionFields = new Set(CRM_FIELD_CATALOG.clienti.map((field) => field.key))
    const missing = CLIENTI_RECORD_FIELDS
      .filter((field) => !permissionFields.has(field.column))
      .map((field) => field.column)

    expect(missing).toEqual([])
  })

  it("carica in lista tutti i campi cliente selezionabili, incluso Importo Contrattuale", () => {
    const listColumns = new Set(CLIENTI_LIST_COLUMN_NAMES)
    const missing = CLIENTI_RECORD_FIELDS
      .filter((field) => !listColumns.has(field.column))
      .map((field) => field.column)

    expect(missing).toEqual([])
    expect(listColumns.has("importo_contrattuale")).toBe(true)
  })

  it("non considera Sede un campo visibile di default in tabella clienti", () => {
    expect(VIRTUAL_UI_FIELDS.has("Sede")).toBe(true)
    expect(CLIENTE_COLUMNS.find((column) => column.id === "Sede")?.defaultVisible).toBe(false)
  })
})
