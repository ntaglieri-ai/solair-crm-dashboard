import { describe, expect, it } from "vitest"
import {
  optionsFromColumnValues,
  option,
  withCurrentColumnOption,
  type CrmColumnValueRow,
} from "@/lib/crm-settings/column-values"

const rows: CrmColumnValueRow[] = [
  {
    id: "1",
    table_name: "leads",
    column_name: "stato_lead",
    value: "da-contattare",
    label: "Da contattare",
    color: null,
    sort_order: 1,
  },
  {
    id: "2",
    table_name: "leads",
    column_name: "origine_lead",
    value: "configuratore-website",
    label: "Configuratore WebSite",
    color: null,
    sort_order: 1,
  },
]

describe("CRM column value options", () => {
  it("usa la label come valore operativo per i campi testuali importati da Zoho", () => {
    expect(optionsFromColumnValues(rows, "stato_lead", [option("Non contattato")])).toEqual([
      { value: "Da contattare", label: "Da contattare", color: null },
    ])
  })

  it("mantiene il fallback quando non ci sono valori configurati", () => {
    expect(optionsFromColumnValues(rows, "sede", [option("Catania")])).toEqual([
      { value: "Catania", label: "Catania" },
    ])
  })

  it("aggiunge il valore corrente se un record contiene ancora una scelta storica", () => {
    expect(withCurrentColumnOption([option("Nuovo")], "Storico")).toEqual([
      { value: "Storico", label: "Storico" },
      { value: "Nuovo", label: "Nuovo" },
    ])
  })
})
